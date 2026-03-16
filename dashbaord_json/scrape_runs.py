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
    "ROUTE": "route",
    "POSTROUTE": "postroute",
}

FREQ_RE = re.compile(r"(\d+(?:p\d+)?)ghz", re.IGNORECASE)
TNSOPT_RE = re.compile(r"\*{3}\s*TnsOpt\s*#(\d+)\s*\[finish\]\s*\(place_opt_design\s*#(\d+)\)", re.IGNORECASE)
OPTDEBUG_RE = re.compile(r"OptDebug:\s*End of Setup Fixing", re.IGNORECASE)
SNAPSHOT_HEADER_RE = re.compile(r"\|\s*Snapshot\s*\|\s*flow\.cputime", re.IGNORECASE)
PSTACK_RE = re.compile(r"=+\s*pstack\s*=+", re.IGNORECASE)
INNOVUS_END_RE = re.compile(r"---\s*Ending\s+\"?Innovus\"?", re.IGNORECASE)
CLOCK_CELL_COUNTS_RE = re.compile(
    r"cell counts\s*:\s*b=(\d+),\s*i=(\d+),\s*icg=(\d+)",
    re.IGNORECASE,
)
CLOCK_CELL_AREA_RE = re.compile(
    r"cell areas\s*:\s*b=[^,]+,\s*i=[^,]+,\s*icg=[^,]+,\s*dcg=[^,]+,\s*l=[^,]+,\s*total=([-+]?\d+(?:\.\d+)?)\s*um\^2",
    re.IGNORECASE,
)
RUN_CACHE_VERSION = 1
STUCK_THRESHOLD_S = 3 * 3600
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CACHE_BASENAME = f"{os.path.splitext(os.path.basename(__file__))[0]}_cache.json"
DEFAULT_CACHE_PATH = os.path.join(
    SCRIPT_DIR,
    DEFAULT_CACHE_BASENAME,
)

RUN_CACHE: Dict[str, Dict[str, object]] = {}
RUN_CACHE_DIRTY = False


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


def resolve_cache_path(path: str) -> str:
    if not path:
        return DEFAULT_CACHE_PATH
    if os.path.isdir(path):
        return os.path.join(path, DEFAULT_CACHE_BASENAME)
    if path.endswith(os.sep):
        return os.path.join(path, DEFAULT_CACHE_BASENAME)
    if os.altsep and path.endswith(os.altsep):
        return os.path.join(path, DEFAULT_CACHE_BASENAME)
    return path


def load_run_cache(path: str) -> None:
    global RUN_CACHE, RUN_CACHE_DIRTY
    path = resolve_cache_path(path)
    RUN_CACHE_DIRTY = False
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        RUN_CACHE = {}
        return
    except Exception:
        RUN_CACHE = {}
        return

    if not isinstance(data, dict):
        RUN_CACHE = {}
        return

    if data.get("version") != RUN_CACHE_VERSION:
        RUN_CACHE = {}
        return

    runs = data.get("runs")
    RUN_CACHE = runs if isinstance(runs, dict) else {}


def save_run_cache(path: str) -> None:
    global RUN_CACHE_DIRTY
    if not RUN_CACHE_DIRTY:
        return
    path = resolve_cache_path(path)
    payload = {
        "version": RUN_CACHE_VERSION,
        "runs": RUN_CACHE,
    }
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    tmp_path = os.path.join(directory, f".{os.path.basename(path)}.tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=False)
        f.write("\n")
    os.replace(tmp_path, path)
    RUN_CACHE_DIRTY = False


def get_cached_run_object(run_dir: str, signature: Dict[str, object], now_ts: float) -> Optional[Dict[str, object]]:
    entry = RUN_CACHE.get(run_dir)
    if not isinstance(entry, dict):
        return None
    if entry.get("signature") != signature:
        return None

    expires_at = entry.get("expires_at")
    if expires_at is not None:
        try:
            if now_ts >= float(expires_at):
                return None
        except (TypeError, ValueError):
            return None

    run_obj = entry.get("run_obj")
    return run_obj if isinstance(run_obj, dict) else None


def set_cached_run_object(run_dir: str, signature: Dict[str, object], run_obj: Dict[str, object], expires_at: Optional[float]) -> None:
    global RUN_CACHE_DIRTY
    entry = {
        "signature": signature,
        "expires_at": expires_at,
        "run_obj": run_obj,
    }
    if RUN_CACHE.get(run_dir) == entry:
        return
    RUN_CACHE[run_dir] = entry
    RUN_CACHE_DIRTY = True


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
    m = re.match(r"^(.*)_(prects|cts|route|postroute)\.log\d*$", fname)
    if not m:
        return None
    return m.group(1)


def get_file_mtime_info(path: str) -> Optional[Tuple[float, int]]:
    try:
        st = os.stat(path)
    except FileNotFoundError:
        return None
    return st.st_mtime, st.st_mtime_ns


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


def parse_metric_line_numeric(line: str, columns: List[str]) -> Dict[str, int]:
    parts = split_table_line(line)
    if not parts:
        return {}
    values = parts[1:] if len(parts) > 1 else []
    out: Dict[str, int] = {}
    for i, col in enumerate(columns):
        if i >= len(values):
            continue
        val = values[i]
        try:
            out[col] = int(float(val))
        except ValueError:
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

    # Optional rows
    viol_line = None
    all_line = None
    wns_idx = lines.index(wns_line)
    for j in range(wns_idx + 1, min(len(lines), wns_idx + 80)):
        line = lines[j]
        if "Violating Paths" in line:
            viol_line = line
        if "All Paths" in line and "TNS" not in line:
            all_line = line

    viol_map = parse_metric_line_numeric(viol_line, columns) if viol_line else {}
    all_map = parse_metric_line_numeric(all_line, columns) if all_line else {}
    if not wns_map and not tns_map:
        return None
    views = {}
    for col in columns:
        view = {}
        if col in wns_map:
            view["WNS"] = wns_map[col]
        if col in tns_map:
            view["TNS"] = tns_map[col]
        if col in viol_map:
            view["violating_paths"] = viol_map[col]
        if col in all_map:
            view["all_paths"] = all_map[col]
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


def get_latest_logv_info(log_path: str) -> Optional[Tuple[str, float, int]]:
    log_dir = os.path.dirname(log_path)
    fname = os.path.basename(log_path)
    m = re.match(r"^(.*)\.log(\d+)?$", fname)
    if not m:
        return None
    base = m.group(1)
    logv_re = re.compile(rf"^{re.escape(base)}\.logv(\d+)?$")
    latest: Optional[Tuple[str, float, int]] = None
    try:
        for name in os.listdir(log_dir):
            if not logv_re.match(name):
                continue
            path = os.path.join(log_dir, name)
            mtime_info = get_file_mtime_info(path)
            if mtime_info is None:
                continue
            mtime, mtime_ns = mtime_info
            if latest is None or mtime_ns > latest[2]:
                latest = (path, mtime, mtime_ns)
    except Exception:
        return None
    return latest


def get_logv_mtime(log_path: str) -> Optional[float]:
    info = get_latest_logv_info(log_path)
    return info[1] if info else None


def detect_stage_status(path: str, runtime: Optional[Dict[str, object]], mtime: float, progress_mtime: Optional[float] = None) -> str:
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
    ref_mtime = progress_mtime if progress_mtime is not None else (get_logv_mtime(path) or mtime)
    if (datetime.datetime.now().timestamp() - ref_mtime) > STUCK_THRESHOLD_S:
        return "stuck"
    return "running"


def collect_stage_sources(run_dir: str) -> Dict[str, Dict[str, object]]:
    log_dir = os.path.join(run_dir, "logs")
    if not os.path.isdir(log_dir):
        return {}

    stage_sources: Dict[str, Dict[str, object]] = {}
    for stage, suffix in STAGES.items():
        log_path = find_latest_stage_log(log_dir, suffix)
        if not log_path:
            continue
        log_mtime_info = get_file_mtime_info(log_path)
        if log_mtime_info is None:
            continue

        log_mtime, log_mtime_ns = log_mtime_info
        stage_source: Dict[str, object] = {
            "stage": stage,
            "suffix": suffix,
            "log_path": log_path,
            "log_mtime": log_mtime,
            "log_mtime_ns": log_mtime_ns,
        }

        logv_info = get_latest_logv_info(log_path)
        if logv_info:
            stage_source["logv_path"] = logv_info[0]
            stage_source["logv_mtime"] = logv_info[1]
            stage_source["logv_mtime_ns"] = logv_info[2]

        partition = parse_partition_from_log(log_path)
        if partition:
            stage_source["partition"] = partition
            report_dir = os.path.join(run_dir, "reports", f"{partition}_{suffix}")

            area_path = os.path.join(report_dir, "area.summary.rpt")
            area_mtime_info = get_file_mtime_info(area_path)
            if area_mtime_info:
                stage_source["area_report_path"] = area_path
                stage_source["area_report_mtime_ns"] = area_mtime_info[1]

            power_path = os.path.join(report_dir, "power.all.rpt")
            power_mtime_info = get_file_mtime_info(power_path)
            if power_mtime_info:
                stage_source["power_report_path"] = power_path
                stage_source["power_report_mtime_ns"] = power_mtime_info[1]

        stage_sources[stage] = stage_source

    return stage_sources


def make_run_signature(stage_sources: Dict[str, Dict[str, object]]) -> Dict[str, object]:
    files: List[Dict[str, object]] = []
    for stage in STAGES:
        stage_source = stage_sources.get(stage)
        if not isinstance(stage_source, dict):
            continue
        for path_key, mtime_ns_key in [
            ("log_path", "log_mtime_ns"),
            ("logv_path", "logv_mtime_ns"),
            ("area_report_path", "area_report_mtime_ns"),
            ("power_report_path", "power_report_mtime_ns"),
        ]:
            path = stage_source.get(path_key)
            mtime_ns = stage_source.get(mtime_ns_key)
            if not isinstance(path, str) or not isinstance(mtime_ns, int):
                continue
            files.append({
                "path": path,
                "mtime_ns": mtime_ns,
            })
    return {
        "version": RUN_CACHE_VERSION,
        "files": files,
    }


def extract_density(path: str) -> Optional[float]:
    # Scan tail for last "Density: NN.NNN%"
    tail = extract_tail_text(path)
    lines = tail.splitlines()
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i]
        m = re.search(r"Density:\s*([0-9]+(?:\.[0-9]+)?)\s*%", line)
        if m:
            return float(m.group(1))
    return None


def extract_drc_totals(path: str) -> Optional[Dict[str, int]]:
    # Scan tail for DRC table totals in route/postroute logs.
    tail = extract_tail_text(path)
    lines = tail.splitlines()
    totals_line = None
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        if line.startswith("#") and "Totals" in line and "|" in line:
            totals_line = line
            break
    if not totals_line:
        return None
    # Example: #  Totals |  5404| 9218|   2513| ... |  80429|
    parts = [p.strip() for p in totals_line.lstrip("#").split("|")]
    # Expect: ["Totals", "5404", "9218", ... , "80429", ""]
    if len(parts) < 3:
        return None
    # Shorts is first numeric column, total is last numeric column
    nums = []
    for p in parts[1:]:
        if not p:
            continue
        try:
            nums.append(int(p))
        except ValueError:
            continue
    if len(nums) < 2:
        return None
    return {"drc_shorts": nums[0], "drc_total": nums[-1]}


def extract_clock_tree_metrics(path: str) -> Optional[Dict[str, object]]:
    lines = read_tail_lines(path, max_bytes=5_000_000)
    counts_match = None
    area_match = None
    for line in reversed(lines):
        if counts_match is None:
            counts_match = CLOCK_CELL_COUNTS_RE.search(line)
        if area_match is None:
            area_match = CLOCK_CELL_AREA_RE.search(line)
        if counts_match and area_match:
            break

    if counts_match is None or area_match is None:
        try:
            with open(path, "r", errors="ignore") as f:
                for line in f:
                    counts_candidate = CLOCK_CELL_COUNTS_RE.search(line)
                    if counts_candidate:
                        counts_match = counts_candidate
                    area_candidate = CLOCK_CELL_AREA_RE.search(line)
                    if area_candidate:
                        area_match = area_candidate
        except Exception:
            pass

    metrics: Dict[str, object] = {}
    if counts_match:
        metrics["clock_buffer_count"] = int(counts_match.group(1))
        metrics["clock_inverter_count"] = int(counts_match.group(2))
        metrics["clock_icg_count"] = int(counts_match.group(3))
    if area_match:
        metrics["clock_cell_area_um2"] = float(area_match.group(1))
    return metrics or None


def extract_error_list(path: str) -> List[str]:
    errors: List[str] = []
    try:
        with open(path, "r", errors="ignore") as f:
            for line in f:
                if line.startswith("**ERROR:"):
                    errors.append(line.rstrip("\n"))
    except Exception:
        return []
    return errors


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


def build_run_object(run_dir: str, stage_sources: Optional[Dict[str, Dict[str, object]]] = None) -> Tuple[Dict[str, object], Optional[float]]:
    run_tag = os.path.basename(run_dir)
    freq = parse_frequency(run_tag)
    obj = {
        "id": run_tag,
        "run_tag": run_tag,
        "frequency_ghz": freq,
        "stages": {},
    }
    stage_sources = stage_sources or collect_stage_sources(run_dir)
    if not stage_sources:
        return obj, None

    next_refresh_at: Optional[float] = None

    for stage, suffix in STAGES.items():
        stage_source = stage_sources.get(stage)
        if not isinstance(stage_source, dict):
            continue
        log_path = stage_source["log_path"]
        views = extract_setup_table(log_path)
        intermediate = extract_intermediate_tnsopt(log_path)
        runtime = extract_runtime_snapshot(log_path)
        mtime = float(stage_source["log_mtime"])
        progress_mtime = float(stage_source.get("logv_mtime", mtime))
        status = detect_stage_status(log_path, runtime, mtime, progress_mtime=progress_mtime)
        if status == "running":
            refresh_at = progress_mtime + STUCK_THRESHOLD_S
            if next_refresh_at is None or refresh_at < next_refresh_at:
                next_refresh_at = refresh_at
        last_updated = datetime.datetime.fromtimestamp(mtime).isoformat()
        density = extract_density(log_path)
        drc_totals = extract_drc_totals(log_path) if stage in {"ROUTE", "POSTROUTE"} else None
        clock_tree_metrics = extract_clock_tree_metrics(log_path)
        error_list = extract_error_list(log_path)
        partition = stage_source.get("partition")
        area = None
        leakage = None
        if isinstance(partition, str):
            report_path = stage_source.get("area_report_path")
            if isinstance(report_path, str):
                area = extract_area_total(report_path, partition)
            power_path = stage_source.get("power_report_path")
            if isinstance(power_path, str):
                leakage = extract_total_leakage(power_path)
        stage_obj: Dict[str, object] = {"stage": stage}
        stage_obj["source_log"] = log_path
        stage_obj["status"] = status
        stage_obj["last_updated"] = last_updated
        if error_list:
            stage_obj["error_list"] = error_list
        metrics: Dict[str, object] = {}
        if area is not None:
            metrics["area_mm2"] = area
        if leakage is not None:
            metrics["leakage_mw"] = leakage
        if density is not None:
            metrics["density_pct"] = density
        if drc_totals:
            metrics.update(drc_totals)
        if clock_tree_metrics:
            metrics.update(clock_tree_metrics)
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
    return obj, next_refresh_at


def build_run_object_cached(run_dir: str, use_cache: bool) -> Dict[str, object]:
    stage_sources = collect_stage_sources(run_dir)
    signature = make_run_signature(stage_sources)
    now_ts = datetime.datetime.now().timestamp()

    if use_cache:
        cached = get_cached_run_object(run_dir, signature, now_ts)
        if cached is not None:
            return cached

    run_obj, expires_at = build_run_object(run_dir, stage_sources=stage_sources)
    if use_cache:
        set_cached_run_object(run_dir, signature, run_obj, expires_at)
    return run_obj


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
        default=os.path.join(SCRIPT_DIR, "partitions.env"),
        help="Partition config file with <name>=<pnr_path> entries",
    )
    parser.add_argument(
        "--output-dir",
        default=SCRIPT_DIR,
        help="Directory to write JSON outputs when using --config",
    )
    parser.add_argument(
        "--cache",
        default=DEFAULT_CACHE_PATH,
        help="Cache file, or directory for the default cache filename",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable cache read/write",
    )
    args = parser.parse_args()
    use_cache = not args.no_cache

    if use_cache:
        load_run_cache(args.cache)

    if args.base_dir:
        output = args.output
        if not output:
            # base-dir pattern: .../<partition>/cdns/pnr
            base_dir = args.base_dir.rstrip("/").rstrip("\\")
            partition = os.path.basename(os.path.dirname(os.path.dirname(base_dir)))
            output = os.path.join(SCRIPT_DIR, f"dashboard_session_export_{partition}.json")

        runs = list_runs(args.base_dir)
        results = []
        for run_dir in runs:
            results.append(build_run_object_cached(run_dir, use_cache=use_cache))

        write_json_atomic(output, results)
        if use_cache:
            save_run_cache(args.cache)
        return 0

    partitions = load_partitions(args.config)
    if not partitions:
        raise SystemExit(f"No partitions found in {args.config}")

    os.makedirs(args.output_dir, exist_ok=True)
    for name, base_dir in partitions.items():
        runs = list_runs(base_dir)
        results = []
        for run_dir in runs:
            results.append(build_run_object_cached(run_dir, use_cache=use_cache))
        output = os.path.join(args.output_dir, f"dashboard_session_export_{name}.json")
        write_json_atomic(output, results)
        if use_cache:
            save_run_cache(args.cache)
    if use_cache:
        save_run_cache(args.cache)
    return 0


def write_json_atomic(path: str, data: list) -> bool:
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    tmp_path = os.path.join(directory, f".{os.path.basename(path)}.tmp")
    payload = json.dumps(data, indent=2, sort_keys=False)
    payload += "\n"
    try:
        with open(path, "r", encoding="utf-8") as f:
            if f.read() == payload:
                return False
    except FileNotFoundError:
        pass
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp_path, path)
    return True


if __name__ == "__main__":
    raise SystemExit(main())
