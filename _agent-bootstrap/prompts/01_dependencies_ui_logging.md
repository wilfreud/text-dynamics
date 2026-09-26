# Task 01 — dependencies, shadcn/ui, and development logging harness

Execute only this task.

Read first:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `.agents/skills/observability-debugging/SKILL.md`
- `_agent-bootstrap/specs/LOGGING_DEBUGGING.md`
- `_agent-bootstrap/SOURCES.md`

## 1. Re-inspect dependency state

Use the existing package manager. Do not replace lockfiles. Inspect current Cargo dependencies before adding crates.

## 2. shadcn/ui

If shadcn is not initialized, initialize it using the current official CLI in a way compatible with the existing React/Vite/Tailwind setup. Choose a neutral/monochrome base. If already initialized, preserve and reuse it.

Confirm the shadcn MCP server configuration remains available through `.agents/mcp_config.json`.

Do not install a huge component catalog. Add only primitives currently needed for the shell/settings/tooltip/popover/buttons/inputs/separators later, or defer component installation until the feature task that needs it.

## 3. Add only justified dependencies

Expected candidates, only when not already solved:

Frontend:

- `animejs`
- `@logtape/logtape`
- `@logtape/redaction` if using its redaction helpers
- `@tauri-apps/plugin-log`

Rust:

- Tauri log plugin crate
- `reqwest` with minimal needed TLS/JSON features for Gemini later
- `serde` / `serde_json` if not present
- `thiserror` if not present and useful
- OS credential-store crate/adaptor only when required by settings implementation (may be deferred)
- SQLite crate only when required by Task 02 (may be deferred)

Do not install React Flow, Redux, an ORM, or a Google/Vertex SDK.

## 4. Build the logging harness

Implement `_agent-bootstrap/specs/LOGGING_DEBUGGING.md`.

Required outcomes:

- project `logs/` directory;
- `logs/*.log` ignored from git while keeping the directory if useful;
- frontend LogTape setup with categories;
- console sink;
- async sanitized bridge into Tauri logging;
- Rust/Tauri logging plugin configured;
- development logs can reach stdout and a persistent log file;
- `scripts/dev-with-logs.sh` (or equivalent) uses `tee`, `set -o pipefail`, timestamped log, and a stable `logs/dev.latest.log`;
- package-manager script `dev:logged` that starts the normal Tauri dev process through that launcher; if safe/unambiguous, make logged startup the default `dev` path and retain the original as `dev:raw`;
- `scripts/check-frontend.sh` based on the repository's actual frontend scripts;
- `scripts/check-rust.sh` for fmt/clippy/check;
- `scripts/debug-context.sh` for bounded log tails/search-oriented diagnosis.

If project-local `tauri-plugin-log` file targeting is awkward before runtime path wiring, retain normal plugin LogDir and rely on tee for `logs/dev.latest.log`; do not create fragile path hacks. Document the actual result.

## 5. Redaction

Ensure obvious fields like `apiKey`, `api_key`, `token`, `secret`, `authorization`, and `password` never reach sinks unredacted. Never log entire source text.

## Verification

Run the relevant frontend install/build/typecheck/lint commands and Rust fmt/clippy/check that are valid for the scaffold. Start the logged dev command long enough to confirm `logs/dev.latest.log` receives process output, then stop it cleanly.

Fix configuration errors before stopping.
