#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_FILE="logs/dev.latest.log"
LINES=80
SEARCH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--lines)
      LINES="$2"
      shift 2
      ;;
    -s|--search|--grep)
      SEARCH="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [-n lines] [-s search_pattern]"
      echo "  -n, --lines   Number of lines to tail (default: 80)"
      echo "  -s, --search  Grep pattern to search in log"
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        LINES="$1"
        shift
      else
        echo "Unknown option: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ ! -f "$LOG_FILE" ]]; then
  echo "[debug-context] Log file not found at $LOG_FILE" >&2
  exit 1
fi

echo "=== Git Status ==="
git status --short
echo ""

if [[ -n "$SEARCH" ]]; then
  echo "=== Searching for '$SEARCH' in $LOG_FILE ==="
  grep -n -C 3 "$SEARCH" "$LOG_FILE" | tail -n "$LINES" || echo "No matches found."
else
  echo "=== Last $LINES lines of $LOG_FILE ==="
  tail -n "$LINES" "$LOG_FILE"
fi
