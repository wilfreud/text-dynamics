# Debugging & Observability Guide

This guide describes the logging infrastructure, diagnostic scripts, agent log-reading protocols, and troubleshooting procedures for Text Dynamics.

---

## 1. The Dual Logging Pipeline

Text Dynamics combines structured frontend logging and native Rust logging into a synchronized, queryable output:

- **Frontend (`src/lib/logger.ts`)**:
  - Uses **LogTape** with distinct hierarchical categories: `app`, `editor`, `analysis`, `graph`, `settings`, `ipc`.
  - Configured with a formatted console sink and an IPC sink that forwards sanitized records to Rust's `@tauri-apps/plugin-log`.
- **Rust Backend (`src-tauri/src/logging.rs`)**:
  - Uses `tauri-plugin-log` and native `log` macros (`info!`, `warn!`, `error!`, `debug!`).
  - Logs are routed to stdout/stderr and written to local log files under `logs/`.

---

## 2. Dev Launcher: `dev:logged`

To run the application with automated log recording:

```bash
bun run dev:logged
```

### Launcher Mechanics (`scripts/dev-with-logs.sh`):
1. Ensures the `logs/` directory exists.
2. Creates a unique timestamped session log (e.g., `logs/dev-20260926-021500.log`).
3. Runs `bun run tauri dev` with `set -o pipefail`.
4. Combines `stdout` and `stderr`, piping output through `tee` to both the terminal and the log file.
5. Continuously maintains `logs/dev.latest.log` pointing to the active session.
6. Preserves the exact exit status of the underlying Tauri process.

---

## 3. Diagnostic Commands

Four dedicated shell scripts provide quick health and verification checks without invoking heavy GUI dependencies:

### 1. Frontend Check (`./scripts/check-frontend.sh`)
Executes TypeScript typechecking and Vite production asset bundling:
```bash
./scripts/check-frontend.sh
```

### 2. Rust Quality Gate (`./scripts/check-rust.sh`)
Verifies Rust formatting, runs Clippy with all warnings denied, and runs `cargo check`:
```bash
./scripts/check-rust.sh
```

### 3. Log Inspection (`./scripts/debug-context.sh`)
Inspects the latest development log with safe, bounded tails:
```bash
# View last 80 lines (default)
./scripts/debug-context.sh

# View last 150 lines
./scripts/debug-context.sh 150

# Search for specific pattern (e.g. request ID or error)
./scripts/debug-context.sh 200 "req_e128"
```

---

## 4. Agent Bounded Log-Reading Protocol

When diagnosing failures during development or testing, agents and developers must adhere to the following protocol:

1. **Check Exit & Git Status First**: Check the failing command exit code and recent git changes before opening logs.
2. **Start Small**: Read only the last 80 lines (`tail -n 80 logs/dev.latest.log` or `./scripts/debug-context.sh`).
3. **Filter by Request Correlation**: Correlate Gemini network calls by searching for `[req_id=...]`.
4. **Controlled Expansion**: Expand to 200 lines only if the stack trace or context is truncated.
5. **Never Blind Ingest**: Do not ingest entire unbounded log files into model context.

---

## 5. Secret Redaction & Privacy Invariants

To prevent accidental leaks of credentials or private user literature, the following data must **never** appear in log outputs:

- ❌ Gemini API keys or tokens.
- ❌ HTTP `Authorization` or `x-goog-api-key` header contents.
- ❌ OS Credential Store (Keyring) values.
- ❌ Full document or poem contents by default.

### Permitted / Safe Request Telemetry:
- ✅ Request Correlation ID (`req_<uuid>`).
- ✅ Document UUID.
- ✅ Character count and unit count.
- ✅ Model identifier (e.g., `gemini-3.8-flash`).
- ✅ Prompt and schema version (`text-dynamics-1`, `1.0`).
- ✅ HTTP response status code and latency (ms).
- ✅ Attempt number and retry backoff duration.
- ✅ Typed error codes (`missing_api_key`, `rate_limit_exceeded`, etc.).

---

## 6. Troubleshooting Common Issues

### 1. "Missing API Key" (`missing_api_key`)
- **Cause**: No key has been saved in the host OS credential store yet.
- **Fix**: Open the **Settings** dialog in the top navigation bar, paste a valid Google Gemini API key, and click **Save Key**. The key will be stored securely in the native OS Keychain.

### 2. "Unauthorized API Key" (`unauthorized_api_key` / HTTP 401/403)
- **Cause**: The API key stored in the OS Keyring was rejected by Google.
- **Fix**: Re-open Settings, delete the key, and re-enter a valid Gemini API key. Ensure the key has permissions for the Generative Language API.

### 3. "Model Not Found" (`model_not_found` / HTTP 404)
- **Cause**: The model ID configured in Settings is invalid or deprecated.
- **Fix**: In Settings, reset the Model ID to the default `gemini-3.8-flash`.

### 4. macOS Keyring Compilation Errors
- **Cause**: The `keyring` crate requires native platform features on macOS to link against `security-framework`.
- **Fix**: Ensure `Cargo.toml` contains `keyring = { version = "3", features = ["apple-native"] }`.
