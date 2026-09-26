#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/src-tauri"

echo "==> Checking cargo fmt..."
cargo fmt --check

echo "==> Checking cargo clippy..."
cargo clippy -- -D warnings

echo "==> Checking cargo check..."
cargo check

echo "==> Rust checks passed."
