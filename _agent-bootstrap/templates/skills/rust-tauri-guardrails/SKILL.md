---
name: rust-tauri-guardrails
description: Use for Rust/Tauri commands, services, persistence, HTTP, secrets, and IPC. Keeps commands thin, errors typed, async work safe, dependencies restrained, and validation explicit.
---

# Rust/Tauri guardrails

## Before editing

Inspect `Cargo.toml`, current modules, plugin setup, Tauri capabilities/config, and existing error/logging conventions. Do not add a duplicate crate because a prompt mentioned one.

## Commands

- Tauri commands are adapters at the IPC boundary.
- Deserialize/validate command input, call a capability/service, map typed errors, return serializable output.
- Keep HTTP and SQL out of command bodies when they exceed trivial wiring.

## Errors

- Use a project error enum (`thiserror` is appropriate if not already solved).
- Preserve useful cause context in logs while returning stable, user-readable error variants across IPC.
- Do not expose API keys, raw auth headers, or massive provider payloads in error strings.
- Avoid `unwrap`/`expect` in runtime paths.

## Async

- Gemini HTTP call is async with a finite timeout.
- Never hold a lock across `.await`.
- Bound retries; maximum attempts must be obvious in code.
- SQLite work can stay simple/synchronous for this personal app. Do not force an async DB stack without a demonstrated need.

## Persistence

Prefer Rust-owned SQLite access. If the scaffold already has a sensible SQLite layer, preserve it. If choosing from scratch, a small `rusqlite` repository is acceptable. Keep schema/migrations explicit and versioned.

## Secrets

API keys do not belong in SQLite, source, committed `.env`, or logs. Prefer the OS credential store on the immediate desktop target. Keep the secret adapter tiny so storage can be replaced later if needed.

## Quality gate

Run:

- `cargo fmt --check`
- `cargo clippy -- -D warnings`
- `cargo check`

Do not suppress warnings globally merely to make the gate green.

## Sources

- Tauri commands: https://v2.tauri.app/develop/calling-rust/
- Rust API guidelines: https://rust-lang.github.io/api-guidelines/
- Clippy: https://doc.rust-lang.org/clippy/usage.html
