#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON:-python3}"
INTERVAL_SEC=3600
CACHE_PATH=""
DISABLE_CACHE=0

usage() {
  echo "Usage: $0 [--interval <sec>] [--cache <path>] [--no-cache]"
  echo "  --interval <sec>  Sleep interval between runs (default: 3600)"
  echo "  --cache <path>    Override scraper cache file path or cache directory"
  echo "  --no-cache        Disable scraper cache reads/writes"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval)
      INTERVAL_SEC="${2:-}"
      shift 2
      ;;
    --cache)
      CACHE_PATH="${2:-}"
      DISABLE_CACHE=0
      shift 2
      ;;
    --no-cache)
      CACHE_PATH=""
      DISABLE_CACHE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      usage
      exit 1
      ;;
  esac
done

while true; do
  echo "[`date -Is`] running scrape_runs.py"
  cmd=("$PYTHON" "$SCRIPT_DIR/scrape_runs.py")
  if [[ "$DISABLE_CACHE" -eq 1 ]]; then
    cmd+=(--no-cache)
  elif [[ -n "$CACHE_PATH" ]]; then
    cmd+=(--cache "$CACHE_PATH")
  fi
  "${cmd[@]}"
  echo "[`date -Is`] done; sleeping ${INTERVAL_SEC}s"
  sleep "$INTERVAL_SEC"
done
