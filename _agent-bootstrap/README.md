# Poem Dynamics — Agent Build Kit

This kit is meant to be extracted **inside an already-created Tauri + React repository**. It does not assume a clean repository and it must not blindly replace existing project configuration.

The implementation is intentionally local-first and small. The engineering prompts are deliberately written in English because the coding surface/documentation is English-first and this reduces ambiguity for Antigravity/Codex-style agents.


- Tauri + React desktop application.
- Paste/write text only. No file import workflow.
- No artificial application-level character limit. Provider/model context limits still exist and must surface as explicit errors.
- One-shot Gemini analysis from the Rust side using the Gemini REST API.
- SQLite for local documents/analyses/overrides.
- Gemini API key stored outside SQLite, preferably in the OS credential store.
- Interactive custom SVG graph; no React Flow requirement.
- Anime.js only for presentation/motion, never as domain state.
- Monochrome UI; no branding/logo work.
- No auth, sync, collaboration, cloud backend, telemetry, analytics, or deployment work.
- No default TDD/test-suite scaffold. Verification is lint/typecheck/build/manual smoke + logs unless the user explicitly asks for tests.

## Important assumption

The dictated request to “install ChatGPT and the real MCP server” is interpreted as **shadcn/ui + the official shadcn MCP server**. This matches the request for a black/white UI component layer and an official MCP server. If the repository already has shadcn configured, preserve it and merge rather than reinitialize it.

## Why direct Gemini REST instead of Vertex AI or a Rust Gemini crate?

This app is a single-user local tool making a simple non-interactive request. Use a Gemini API key and a direct HTTPS call from Rust. Do **not** introduce Vertex AI, service accounts, ADC, Cloud IAM, or a Google Cloud deployment architecture.

The current official Gemini API supports structured JSON output with a schema. The current official model target for this kit is `gemini-3.8-flash`, but the model ID must remain user-configurable because model availability changes.

## How to use this kit

1. Create and run your base Tauri + React project yourself.
2. Extract this folder at repository root as `_agent-bootstrap/` (or rename this extracted folder to that name).
3. Open `RUNBOOK.md`.
4. Give the coding agent one prompt at a time, in order.
5. Inspect the diff after each step. Do not let the agent jump ahead.
6. Keep `_agent-bootstrap/` until the final audit is done, then delete it if desired.

Task `00` installs/merges the actual project-level `AGENTS.md`, `.agents/rules`, `.agents/skills`, and `.agents/mcp_config.json` from the templates in this kit.
