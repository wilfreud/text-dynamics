---
name: observability-debugging
description: Use when configuring logs or diagnosing build/runtime/Gemini/UI failures. Establishes bounded log inspection, request correlation, secret redaction, and smallest-fix debugging.
---

# Observability and debugging

## Logging architecture

- Frontend: LogTape categories + console + sanitized async bridge to Tauri logging.
- Rust: `tauri-plugin-log` / Rust `log` unless an existing tracing stack should be preserved.
- Dev process: stdout/stderr tee to project `logs/`.

## Never log

- API keys/tokens;
- authorization headers;
- credential-store values;
- complete poems by default.

## Correlation

Gemini analyses should have a local request ID. Log request ID, document ID, model, unit count/source length, latency, HTTP status, retry attempt, and validation result.

## Debug protocol

1. Reproduce once if safe.
2. Record the exact failing command/action.
3. Check `git status --short` and current diff around the feature.
4. Read `tail -n 80 logs/dev.latest.log`.
5. Search by request ID/category/error.
6. Expand to 200/500 lines only when the smaller view is insufficient.
7. Form a hypothesis before changing code.
8. Apply the smallest coherent fix.
9. Rerun the narrow failing path and relevant quality gates.
10. Stop; do not opportunistically refactor unrelated modules.

## Sources

- Tauri logging: https://v2.tauri.app/plugin/logging/
- LogTape sinks: https://logtape.org/manual/sinks
- LogTape redaction: https://logtape.org/manual/redaction
