# Project agent instructions

This is a local-first Tauri + React desktop application for visualizing the dynamic structure of literary text.

## Mandatory workflow

Before editing executable code, read and follow `.agents/skills/tiger-style/SKILL.md`.

Load additional skills when relevant:

- Rust/Tauri/IPC: `.agents/skills/rust-tauri-guardrails/SKILL.md`
- Gemini request/schema work: `.agents/skills/gemini-structured-output/SKILL.md`
- logging/debugging: `.agents/skills/observability-debugging/SKILL.md`
- UI motion: `.agents/skills/animejs/SKILL.md`
- final structural cleanup/refactor: `.agents/skills/structural-refactor/SKILL.md`

Do **not** use a TDD/spec-locked skill unless the user explicitly asks for it.

## Repository-first rule

Never assume the scaffold. Before installing, removing, or reconfiguring anything, inspect:

- git status/diff;
- package-manager lockfile;
- `package.json`;
- `src-tauri/Cargo.toml`;
- Tauri config;
- existing source tree;
- existing `components.json`/shadcn config;
- existing lint/format/build scripts.

Preserve sensible existing choices. Merge configuration instead of blindly replacing it.

## Product constraints

- Local desktop tool. No auth/cloud/multi-user architecture.
- User pastes or writes plain text; no file import feature.
- No arbitrary application character cap; provider limits must be explicit errors.
- Gemini calls originate from Rust, not the browser/webview.
- No Vertex AI/service accounts/ADC unless the user explicitly changes the architecture.
- SQLite is local persistence; frontend must not own raw SQL if Rust already owns persistence.
- Gemini API key must not be stored in SQLite or logged.
- AI base analysis and user overrides are distinct persisted concepts.
- Custom SVG graph is preferred to generic node-edge frameworks.
- Monochrome editorial UI. No branding/logo/AI-dashboard decoration.

## Logging

Runtime diagnostics belong in `logs/` during development. Never log secrets or entire poems by default. When debugging, inspect bounded tails/searches before widening context.

## Verification

There is no default TDD requirement. Do not add a test framework unless asked. Verify with existing frontend lint/typecheck/build, Rust fmt/clippy/check, a smoke run, and logs.

## Documentation

Keep project docs concise and current when contracts or architecture change.
