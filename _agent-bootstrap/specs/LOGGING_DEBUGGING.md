# Logging and debugging specification

## Goal

Every development run should leave enough structured evidence for an agent to diagnose problems without dumping the entire application state into context.

## Two layers, one story

### Frontend

Use LogTape for application logs/categories.

Expected categories include:

- `app`
- `editor`
- `analysis`
- `graph`
- `settings`
- `ipc`

Configure:

- console sink for immediate developer visibility;
- an async sink that forwards sanitized log records to `@tauri-apps/plugin-log` so frontend and Rust diagnostics land in the Tauri logging pipeline.

Use LogTape redaction or equivalent field filtering. Better yet, never put secrets in a log record.

### Rust

Use `tauri-plugin-log` / Rust `log` macros unless the repository already has a coherent tracing stack. Do not introduce two competing Rust logging frameworks without a reason.

In debug builds, log to:

- stdout/stderr;
- project-local `logs/` custom folder if practical.

In release builds, use the platform-recommended application log directory.

## Tee-like dev launcher

Create a shell launcher (macOS/Linux is the immediate target) that:

1. creates `logs/`;
2. creates a timestamped dev log;
3. runs the existing Tauri dev command;
4. combines stdout and stderr;
5. pipes output through `tee`;
6. maintains a stable `logs/dev.latest.log` reference/file;
7. preserves the underlying command exit code (`set -o pipefail`).

Expose it through the existing package manager as `dev:logged`. If the repository has one obvious primary local dev script and wrapping it is safe, make the logged launcher the default `dev` behavior and preserve the original command as `dev:raw`; otherwise leave the original untouched and document that `dev:logged` is the canonical diagnostic launcher.

## Debug helper scripts

Create minimal scripts/commands for:

- `scripts/check-frontend.sh`: frontend type/lint/build diagnostics using the repository's existing package manager/scripts;
- `scripts/check-rust.sh`: Rust `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo check`;
- `scripts/debug-context.sh`: show a bounded log context (default small tail, optional explicit expansion).

Do not invent a full build system.

## Agent log-reading protocol

When debugging:

1. inspect the exact failing command and git diff/status;
2. read `tail -n 80 logs/dev.latest.log`;
3. search for a relevant request ID/category/error string;
4. expand to 200 lines only if necessary;
5. expand again only with a concrete hypothesis;
6. never ingest the entire log blindly.

## Privacy / secrets

Never log:

- Gemini API key;
- authorization headers;
- OS credential values;
- full poem/source text by default.

Safe request diagnostics:

- request ID;
- document ID;
- source character count;
- unit count;
- model ID;
- prompt version;
- HTTP status;
- latency;
- retry attempt number;
- validation result/error class.
