# Task 04 — direct Gemini structured-output integration in Rust

Execute only this task.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `.agents/skills/rust-tauri-guardrails/SKILL.md`
- `.agents/skills/gemini-structured-output/SKILL.md`
- `.agents/skills/observability-debugging/SKILL.md`
- `_agent-bootstrap/specs/GEMINI.md`
- `_agent-bootstrap/specs/DOMAIN_AND_SCHEMA.md`
- `_agent-bootstrap/SOURCES.md`

## Fresh-doc requirement

Before writing the HTTP request, open the current official Gemini `generateContent` and structured-output docs. The kit was researched on 2026-09-26, but current docs win if the request shape changed.

## Architecture decision

Use direct HTTPS from Rust with `reqwest` (or the repository's already-established HTTP client).

Do not use:

- Vertex AI;
- service accounts;
- Google ADC;
- Cloud IAM;
- the third-party `google_genai` Rust crate;
- a frontend/browser Gemini request.

## API behavior

- API key from the secret/settings service.
- Auth via the current Gemini API key mechanism (`x-goog-api-key` at research time).
- One-shot, non-streaming GenerateContent request.
- Default configured model: `gemini-3.8-flash`.
- Model ID is user-configurable.
- Send stable source unit IDs/text and core analysis prompt + optional custom instruction.
- Request JSON structured output with the exact domain schema using the current API-level mechanism.
- Deserialize to typed Rust values.
- Run semantic validation before returning/persisting.
- Persist validated base analysis with model and prompt version.

## Reliability

- finite HTTP timeout;
- finite response body handling appropriate to the known model output limit;
- at most a small bounded retry policy for transient network/429/5xx failures;
- no retry for validation/auth/not-found/input-too-large errors unless there is a concrete reason;
- request correlation ID;
- preserve previous valid analysis on failure.

## Errors

Map provider/network failures to stable application error kinds described in `_agent-bootstrap/specs/GEMINI.md`.

Do not expose raw provider HTML or secret-bearing debug dumps to the UI.

## Logging

Log request ID, document ID, model, source length/unit count, prompt version, attempt, latency, HTTP status, parse/semantic validation outcome. Do not log key or entire poem.

## Tauri command

Add one thin async `analyze_document`/equivalent command that invokes the service. The frontend should call through its typed IPC adapter.

## Manual smoke

If no real API key is configured, the application must fail cleanly with a “missing API key” state. If a key is available locally, perform one small real analysis and verify structured output + persistence + logs. Never commit the key or response content containing private text.
