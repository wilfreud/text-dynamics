---
trigger: glob
description: Rust and Tauri implementation rules.
globs: "src-tauri/**/*.rs, src-tauri/Cargo.toml"
---

- Read `.agents/skills/rust-tauri-guardrails/SKILL.md` before substantive Rust changes.
- Tauri commands are thin IPC boundaries; orchestration belongs in service/capability modules.
- Validate all frontend and provider data at boundaries.
- Use explicit `Result` errors; avoid `unwrap`/`expect` in normal runtime paths.
- Never log secrets, authorization headers, or full poem content by default.
- Never hold a lock across `.await`.
- Bound retries, loops, payload handling, and timeouts.
- Avoid `unsafe` unless the user explicitly accepts a documented necessity.
- Keep `lib.rs` wiring-focused.
