#!/usr/bin/env python3
import argparse
import json
import os
import re
import datetime
from typing import Dict, List, Optional, Tuple


STAGES = {
    "PRECTS": "prects",
    "CTS": "cts",
    "POSTROUTE": "postroute",
}

FREQ_RE = re.compile(r"(\d+(?:p\d+)?)ghz", re.IGNORECASE)
TNSOPT_RE = re.compile(r"\*{3}\s*TnsOpt\s*#(\d+)\s*\[finish\]\s*\(place_opt_design\s*#(\d+)\)", re.IGNORECASE)
OPTDEBUG_RE = re.compile(r"OptDebug:\s*End of Setup Fixing", re.IGNORECASE)
SNAPSHOT_HEADER_RE = re.compile(r"\|\s*Snapshot\s*\|\s*flow\.cputime", re.IGNORECASE)
PSTACK_RE = re.compile(r"=+\s*pstack\s*=+", re.IGNORECASE)
INNOVUS_END_RE = re.compile(r"---\s*Ending\s+\"?Innovus\"?", re.IGNORECASE)


def parse_frequency(run_tag: str) -> Optional[float]:
    m = FREQ_RE.search(run_tag)
    if not m:
        return None
    return float(m.group(1).replace("p", "."))


def list_runs(base_dir: str) -> List[str]:
    try:
        entries = os.listdir(base_dir)
    except FileNotFoundError:
        return []
    runs = []
    for name in entries:
        if not name.startswith("pnr_tag"):
            continue
        path = os.path.join(base_dir, name)
        if os.path.isdir(path):
            runs.append(path)
    return sorted(runs)


def load_partitions(config_path: str) -> Dict[str, str]:
    partitions: Dict[str, str] = {}
    if not os.path.isfile(config_path):
        return partitions
    with open(config_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            name, path = line.split("=", 1)
            name = name.strip()
            path = path.strip()
            if name and path:
                partitions[name] = path
    return partitions


def is_valid_log(filename: str) -> bool:
    if filename.endswith("logv") or re.search(r"\.logv\d+$", filename):
        return False
    if re.search(r"\.report_.*\.log(\d+)?$", filename):
        return False
    return True


def find_latest_stage_log(log_dir: str, stage_suffix: str) -> Optional[str]:
    # Match any partition prefix: <partition>_<stage>.log or .logN
    candidates = []
    log_re = re.compile(rf"^(.*)_{re.escape(stage_suffix)}\.log(\d+)?$")
    for fname in os.listdir(log_dir):
        if not is_valid_log(fname):
            continue
        if log_re.match(fname):
            candidates.append(os.path.join(log_dir, fname))
    if not candidates:
        return None
    candidates.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return candidates[0]


def parse_partition_from_log(path: str) -> Optional[str]:
    fname = os.path.basename(path)
    m = re.match(r"^(.*)_(prects|cts|postroute)\.log\d*$", fname)
    if not m:
        return None
    return m.group(1)


def read_tail_lines(path: str, max_bytes: int = 3_000_000) -> List[str]:
    # Read last max_bytes of file to find the final setup table
    with open(path, "rb") as f:
        f.seek(0, os.SEEK_END)
        size = f.tell()
        start = max(0, size - max_bytes)
        f.seek(start)
        data = f.read()
    try:
        text = data.decode("utf-8", errors="ignore")
    except Exception:
        text = data.decode(errors="ignore")
    return text.splitlines()


def find_setup_table(lines: List[str]) -> Optional[Tuple[List[str], str, str]]:
    """
    Returns (columns, wns_line, tns_line) from the last Setup mode table block.
    """
    # Scan backwards for header line containing "Setup mode"
    header_idx = None
    for i in range(len(lines) - 1, -1, -1):
        if "Setup mode" in lines[i]:
            header_idx = i
            break
    if header_idx is None:
        return None

    header_line = lines[header_idx]
    # Find WNS and TNS lines after header
    wns_line = None
    tns_line = None
    for j in range(header_idx + 1, min(len(lines), header_idx + 50)):
        line = lines[j]
        if "WNS (ns)" in line:
            wns_line = line
        if "TNS (ns)" in line:
            tns_line = line
        if wns_line and tns_line:
            break

    if not wns_line or not tns_line:
        # Try to find preceding lines if table is above header in tail slice
        for j in range(header_idx - 1, max(-1, header_idx - 50), -1):
            line = lines[j]
            if "WNS (ns)" in line:
                wns_line = line
            if "TNS (ns)" in line:
                tns_line = line
            if wns_line and tns_line:
                break

    columns = parse_columns(header_line)
    if not columns or not wns_line or not tns_line:
        return None
    return columns, wns_line, tns_line


def split_table_line(line: str) -> List[str]:
    # Split on '|' and strip
    parts = [p.strip() for p in line.strip().split("|")]
    return [p for p in parts if p]


def parse_columns(header_line: str) -> List[str]:
    parts = split_table_line(header_line)
    # Header often like: Setup mode | all | reg2reg | ...
    columns = []
    for p in parts:
        if "Setup mode" in p:
            continue
        columns.append(p)
    return columns


def parse_metric_line(line: str, columns: List[str]) -> Dict[str, float]:
    parts = split_table_line(line)
    if not parts:
        return {}
    # First part is label like "WNS (ns):"
    values = parts[1:] if len(parts) > 1 else []
    out = {}
    for i, col in enumerate(columns):
        if i >= len(values):
            continue
        val = values[i]
        try:
            out[col] = float(val)
        except ValueError:
            # Handle placeholders like '-' or 'N/A'
            continue
    return out


def extract_setup_table(path: str) -> Optional[Dict[str, Dict[str, float]]]:
    lines = read_tail_lines(path)
    found = find_setup_table(lines)
    if not found:
        return None
    columns, wns_line, tns_line = found
    wns_map = parse_metric_line(wns_line, columns)
    tns_map = parse_metric_line(tns_line, columns)
    if not wns_map and not tns_map:
        return None
    views = {}
    for col in columns:
        view = {}
        if col in wns_map:
            view["WNS"] = wns_map[col]
        if col in tns_map:
            view["TNS"] = tns_map[col]
        if view:
            views[col] = view
    return views or None


def parse_hhmmss(value: str) -> Optional[int]:
    value = value.strip()
    if not value:
        return None
    if not re.match(r"^\d+:\d{2}:\d{2}$", value):
        return None
    h, m, s = value.split(":")
    return int(h) * 3600 + int(m) * 60 + int(s)


def extract_runtime_snapshot(path: str) -> Optional[Dict[str, object]]:
    lines = read_tail_lines(path)
    header_idx = None
    for i in range(len(lines) - 1, -1, -1):
        if SNAPSHOT_HEADER_RE.search(lines[i]):
            header_idx = i
            break
    if header_idx is None:
        return None

    header_cols = split_table_line(lines[header_idx])
    # Expect columns like: Snapshot, flow.cputime (s), flow.realtime (s), timing.setup.tns (ns), timing.setup.wns (ns)
    col_idx = {name: idx for idx, name in enumerate(header_cols)}

    # Find rows below header until a border or empty line
    rows = []
    for j in range(header_idx + 1, min(len(lines), header_idx + 200)):
        line = lines[j]
        if line.strip().startswith("+") or line.strip().startswith("-"):
            continue
        if "|" not in line:
            if rows:
                break
            continue
        parts = split_table_line(line)
        if len(parts) < 2:
            continue
        rows.append(parts)

    if not rows:
        return None

    fname = os.path.basename(path)
    m = re.match(r"^(.*)\.log\d*$", fname)
    if m:
        stage_key = m.group(1)
    elif fname.endswith(".log"):
        stage_key = fname[:-4]
    else:
        stage_key = fname
    target_row = None
    for r in rows:
        if r[0].strip() == stage_key:
            target_row = r
            break
    if not target_row:
        return None

    def get(col_name: str) -> str:
        idx = col_idx.get(col_name)
        if idx is None or idx >= len(target_row):
            return ""
        return target_row[idx].strip()

    cpu = get("flow.cputime (s)")
    real = get("flow.realtime (s)")
    tns = get("timing.setup.tns (ns)")
    wns = get("timing.setup.wns (ns)")
    out: Dict[str, object] = {
        "flow_cputime": cpu or None,
        "flow_realtime": real or None,
        "flow_cputime_s": parse_hhmmss(cpu) if cpu else None,
        "flow_realtime_s": parse_hhmmss(real) if real else None,
    }
    try:
        if tns:
            out["timing_setup_tns"] = float(tns)
    except ValueError:
        pass
    try:
        if wns:
            out["timing_setup_wns"] = float(wns)
    except ValueError:
        pass
    return out


def extract_tail_text(path: str, max_bytes: int = 1_000_000) -> str:
    with open(path, "rb") as f:
        f.seek(0, os.SEEK_END)
        size = f.tell()
        start = max(0, size - max_bytes)
        f.seek(start)
        data = f.read()
    try:
        return data.decode("utf-8", errors="ignore")
    except Exception:
        return data.decode(errors="ignore")


def get_logv_mtime(log_path: str) -> Optional[float]:
    log_dir = os.path.dirname(log_path)
    fname = os.path.basename(log_path)
    m = re.match(r"^(.*)\.log(\d+)?$", fname)
    if not m:
        return None
    base = m.group(1)
    logv_re = re.compile(rf"^{re.escape(base)}\.logv(\d+)?$")
    latest = None
    try:
        for name in os.listdir(log_dir):
            if logv_re.match(name):
                path = os.path.join(log_dir, name)
                mt = os.path.getmtime(path)
                if latest is None or mt > latest:
                    latest = mt
    except Exception:
        return None
    return latest


def detect_stage_status(path: str, runtime: Optional[Dict[str, object]], mtime: float) -> str:
    """
    Status heuristic:
    - completed: snapshot table exists (runtime present)
    - crashed: tail contains pstack banner
    - errored: tail contains 'Ending "Innovus"' but no snapshot
    - running: otherwise
    """
    if runtime:
        return "completed"
    # Crash detection scans entire file (streaming) to catch non-tail pstacks
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
                if PSTACK_RE.search(chunk.decode("utf-8", errors="ignore")):
                    return "crashed"
    except Exception:
        # Fallback to tail if streaming read fails
        tail = extract_tail_text(path)
        if PSTACK_RE.search(tail):
            return "crashed"
    tail = extract_tail_text(path)
    if INNOVUS_END_RE.search(tail):
        return "errored"
    # If logv hasn't updated in >3 hours, mark as stuck (fallback to log mtime)
    ref_mtime = get_logv_mtime(path) or mtime
    if (datetime.datetime.now().timestamp() - ref_mtime) > 3 * 3600:
        return "stuck"
    return "running"


def extract_area_total(report_path: str, design_name: Optional[str]) -> Optional[float]:
    if not report_path or not os.path.isfile(report_path):
        return None
    with open(report_path, "r", errors="ignore") as f:
        lines = f.readlines()
    # Prefer line starting with design name
    if design_name:
        for line in lines:
            if line.strip().startswith(design_name):
                m = re.search(r"([-+]?\d+(?:\.\d+)?)\s*$", line)
                if m:
                    return float(m.group(1))
    # Fallback: first non-header data line after separator
    for line in lines:
        if line.startswith("-"):
            continue
        if line.strip() and not line.lstrip().startswith("#") and "Total Area" not in line:
            m = re.search(r"([-+]?\d+(?:\.\d+)?)\s*$", line)
            if m:
                return float(m.group(1))
    return None


def extract_total_leakage(report_path: str) -> Optional[float]:
    if not report_path or not os.path.isfile(report_path):
        return None
    with open(report_path, "r", errors="ignore") as f:
        for line in f:
            if "Total Leakage Power" in line:
                m = re.search(r"Total Leakage Power:\s*([-+]?\d+(?:\.\d+)?)", line)
                if m:
                    return float(m.group(1))
                break
    return None


def parse_optdebug_table(lines: List[str], start_idx: int) -> Optional[Tuple[Dict[str, Dict[str, float]], int]]:
    """
    Parse OptDebug table starting at or after start_idx.
    Returns (views, end_idx).
    """
    header_idx = None
    for i in range(start_idx, min(len(lines), start_idx + 50)):
        if "Path Group" in lines[i] and "|" in lines[i]:
            header_idx = i
            break
    if header_idx is None:
        return None

    columns = split_table_line(lines[header_idx])
    # Expect: Path Group | WNS | TNS
    if len(columns) < 3:
        return None

    views: Dict[str, Dict[str, float]] = {}
    end_idx = header_idx + 1
    for j in range(header_idx + 1, min(len(lines), header_idx + 2000)):
        line = lines[j]
        if line.strip().startswith("+"):
            # border line; if we've already parsed rows, end here
            if views:
                end_idx = j
                break
            continue
        if "|" not in line:
            if views:
                end_idx = j
                break
            continue
        parts = split_table_line(line)
        if len(parts) < 3:
            continue
        name, wns_str, tns_str = parts[0], parts[1], parts[2]
        metrics: Dict[str, float] = {}
        try:
            metrics["WNS"] = float(wns_str)
        except ValueError:
            pass
        try:
            metrics["TNS"] = float(tns_str)
        except ValueError:
            pass
        if metrics:
            views[name] = metrics
    if not views:
        return None
    return views, end_idx


def extract_intermediate_tnsopt(path: str) -> Optional[List[Dict[str, object]]]:
    """
    Extract intermediate timing tables.
    Preferred mapping: OptDebug table immediately before each TnsOpt finish.
    Fallback: if no TnsOpt markers exist, capture each OptDebug table as OptDebug #N.
    """
    results: List[Dict[str, object]] = []
    optdebug_tables: List[Dict[str, Dict[str, float]]] = []
    with open(path, "r", errors="ignore") as f:
        lines = f.readlines()

    last_table: Optional[Dict[str, Dict[str, float]]] = None
    saw_tnsopt = False
    i = 0
    while i < len(lines):
        line = lines[i]
        if OPTDEBUG_RE.search(line):
            parsed = parse_optdebug_table(lines, i)
            if parsed:
                last_table, i = parsed
                if last_table:
                    optdebug_tables.append(last_table)
        m = TNSOPT_RE.search(line)
        if m and last_table:
            saw_tnsopt = True
            pass_num = int(m.group(1))
            place_num = int(m.group(2))
            results.append({
                "label": f"TnsOpt #{pass_num} (place_opt_design #{place_num})",
                "tnsopt_pass": pass_num,
                "place_opt_design": place_num,
                "views": last_table,
            })
        i += 1

    if results:
        return results
    if not saw_tnsopt and optdebug_tables:
        return [
            {"label": f"OptDebug #{idx + 1}", "views": tbl}
            for idx, tbl in enumerate(optdebug_tables)
        ]
    return None


def build_run_object(run_dir: str) -> Dict:
    run_tag = os.path.basename(run_dir)
    freq = parse_frequency(run_tag)
    obj = {
        "id": run_tag,
        "run_tag": run_tag,
        "frequency_ghz": freq,
        "stages": {},
    }
    log_dir = os.path.join(run_dir, "logs")
    if not os.path.isdir(log_dir):
        return obj

    for stage, suffix in STAGES.items():
        log_path = find_latest_stage_log(log_dir, suffix)
        if not log_path:
            continue
        views = extract_setup_table(log_path)
        intermediate = extract_intermediate_tnsopt(log_path)
        runtime = extract_runtime_snapshot(log_path)
        mtime = os.path.getmtime(log_path)
        status = detect_stage_status(log_path, runtime, mtime)
        last_updated = datetime.datetime.fromtimestamp(mtime).isoformat()
        partition = parse_partition_from_log(log_path)
        area = None
        if partition:
            report_dir = os.path.join(run_dir, "reports", f"{partition}_{suffix}")
            report_path = os.path.join(report_dir, "area.summary.rpt")
            area = extract_area_total(report_path, partition)
            power_path = os.path.join(report_dir, "power.all.rpt")
            leakage = extract_total_leakage(power_path)
        stage_obj: Dict[str, object] = {"stage": stage}
        stage_obj["source_log"] = log_path
        stage_obj["status"] = status
        stage_obj["last_updated"] = last_updated
        metrics: Dict[str, object] = {}
        if area is not None:
            metrics["area_mm2"] = area
        if leakage is not None:
            metrics["leakage_mw"] = leakage
        if metrics:
            stage_obj["metrics"] = metrics
        if views:
            stage_obj["views"] = views
        if intermediate:
            stage_obj["intermediate"] = intermediate
        if runtime:
            stage_obj["runtime"] = runtime
        if len(stage_obj) > 1:
            obj["stages"][stage] = stage_obj
    return obj


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape PnR run logs into dashboard JSON.")
    parser.add_argument(
        "--base-dir",
        default=None,
        help="Base PnR directory containing pnr_tag* runs (if omitted, use --config)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON file path (single base-dir mode only)",
    )
    parser.add_argument(
        "--config",
        default=os.path.join(os.path.dirname(__file__), "partitions.env"),
        help="Partition config file with <name>=<pnr_path> entries",
    )
    parser.add_argument(
        "--output-dir",
        default=os.path.dirname(__file__),
        help="Directory to write JSON outputs when using --config",
    )
    args = parser.parse_args()

    if args.base_dir:
        output = args.output
        if not output:
            # base-dir pattern: .../<partition>/cdns/pnr
            base_dir = args.base_dir.rstrip("/").rstrip("\\")
            partition = os.path.basename(os.path.dirname(os.path.dirname(base_dir)))
            output = os.path.join(os.path.dirname(__file__), f"dashboard_session_export_{partition}.json")

        runs = list_runs(args.base_dir)
        results = []
        for run_dir in runs:
            results.append(build_run_object(run_dir))

        with open(output, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, sort_keys=False)
            f.write("\n")
        return 0

    partitions = load_partitions(args.config)
    if not partitions:
        raise SystemExit(f"No partitions found in {args.config}")

    os.makedirs(args.output_dir, exist_ok=True)
    for name, base_dir in partitions.items():
        runs = list_runs(base_dir)
        results = []
        for run_dir in runs:
            results.append(build_run_object(run_dir))
        output = os.path.join(args.output_dir, f"dashboard_session_export_{name}.json")
        with open(output, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, sort_keys=False)
            f.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
