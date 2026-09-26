#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p logs

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
TIMESTAMP_LOG="logs/dev_${TIMESTAMP}.log"
LATEST_LOG="logs/dev.latest.log"

echo "[dev-with-logs] Logging session to ${TIMESTAMP_LOG} and ${LATEST_LOG}"

# Remove existing latest log
rm -f "$LATEST_LOG"

# Preserve pipeline exit code and stream to console and log files
set -o pipefail
bun run tauri dev 2>&1 | tee "$TIMESTAMP_LOG" "$LATEST_LOG"
