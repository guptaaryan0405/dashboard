#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON:-python3}"
INTERVAL_SEC=3600

usage() {
  echo "Usage: $0 [--interval <sec>]"
  echo "  --interval <sec>  Sleep interval between runs (default: 3600)"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval)
      INTERVAL_SEC="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown арг: $1"
      usage
      exit 1
      ;;
  esac
done

while true; do
  echo "[`date -Is`] running scrape_runs.py"
  "$PYTHON" "$SCRIPT_DIR/scrape_runs.py"
  echo "[`date -Is`] done; sleeping ${INTERVAL_SEC}s"
  sleep "$INTERVAL_SEC"
done
