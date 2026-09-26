# Current documentation sources

Research date: **2026-09-26**.

Agents must prefer current official documentation over remembered APIs. Re-check these sources if a command/API no longer matches.

## Gemini API

- Getting started / API key / structured output: https://ai.google.dev/gemini-api/docs/get-started
- Gemini API reference: https://ai.google.dev/api
- GenerateContent: https://ai.google.dev/api/generate-content
- Structured outputs for GenerateContent: https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- Gemini 3.8 Flash: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash/
- Billing / free and paid tiers: https://ai.google.dev/gemini-api/docs/billing
- Model deprecations: https://ai.google.dev/gemini-api/docs/deprecations

## Google AI plan note

- Google AI Plus benefits: https://support.google.com/googleone/answer/16882689

A Google AI consumer subscription is not the same billing entitlement as Gemini API usage. The app should simply accept a Gemini API key; do not design subscription/account coupling.

## Antigravity / agent configuration

- Skills: https://www.antigravity.google/docs/skills
- Rules / AGENTS.md: https://www.antigravity.google/docs/rules/
- MCP: https://www.antigravity.google/docs/mcp
- CLI reference: https://www.antigravity.google/docs/cli/reference/

## OpenAI / Codex skills conventions

- Skills: https://developers.openai.com/api/docs/guides/tools-skills
- Codex / AGENTS.md background: https://openai.com/index/introducing-codex/

## shadcn/ui

- MCP server: https://ui.shadcn.com/docs/mcp

## Tauri

- Calling Rust from frontend: https://v2.tauri.app/develop/calling-rust/
- Logging plugin: https://v2.tauri.app/plugin/logging/

## Logging

- LogTape sinks / async sink: https://logtape.org/manual/sinks
- LogTape redaction: https://logtape.org/manual/redaction

## Rust

- Rust API Guidelines: https://rust-lang.github.io/api-guidelines/
- Dependability / validate inputs: https://rust-lang.github.io/api-guidelines/dependability.html
- Clippy usage: https://doc.rust-lang.org/clippy/usage.html

## Anime.js

- React integration: https://animejs.com/documentation/getting-started/using-with-react/
- Scope lifecycle: https://animejs.com/documentation/scope/

## User skill repository

- https://github.com/wilfreud/skills-or-something
- Defensive programming: https://github.com/wilfreud/skills-or-something/tree/main/defensive-programming
- Anime.js: https://github.com/wilfreud/skills-or-something/tree/main/animejs
- Structural refactor: https://github.com/wilfreud/skills-or-something/tree/main/structural-refactor

Deliberately excluded from the default workflow:

- `spec-locked-tdd`: the user explicitly does not want a TDD workflow for this project.
- `reactflow`: the visualization is a semantic time/intensity plot, not an arbitrary node-edge editor. A custom SVG renderer better preserves discontinuities such as hard drops/spikes.
