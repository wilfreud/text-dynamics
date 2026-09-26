---
name: gemini-structured-output
description: Use whenever implementing or debugging the Gemini text-dynamics analysis request, structured JSON schema, prompt, model settings, validation, retries, or provider errors.
---

# Gemini structured-output workflow

## First action

Open current official Gemini docs before coding. The API evolves quickly. Prefer the sources in `_agent-bootstrap/SOURCES.md`.

## Project decision

- Direct Gemini REST from Rust.
- No Vertex AI.
- No service account/ADC.
- No third-party Rust Gemini SDK by default.
- One-shot non-streaming request.
- Model setting defaults to `gemini-3.8-flash` but is user-configurable.

## Contract

1. Build deterministic source units locally.
2. Send stable unit IDs + unit text.
3. Request structured JSON with the current API-level JSON Schema mechanism.
4. Deserialize to typed Rust structures.
5. Run semantic validation from `_agent-bootstrap/specs/DOMAIN_AND_SCHEMA.md`.
6. Only then persist/return a valid analysis.

Never ask the model to emit JSON inside Markdown fences as the primary parsing strategy.

## Prompt rules

- The system prompt defines metric/movement semantics.
- Schema constrains shape/enums/ranges as far as supported.
- User custom instruction is an appended tuning layer, not a replacement prompt.
- Persist a prompt version.

## Failure policy

No silent truncation, no auto-repair that invents source IDs, no infinite retries. Return a typed error and keep the previous valid analysis intact.

## Sources

- https://ai.google.dev/gemini-api/docs/get-started
- https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/deprecations
