# Gemini integration specification

## Decision

Use the **Gemini API directly from Rust over HTTPS**.

Do not use Vertex AI, service accounts, ADC, Cloud IAM, or a Google Cloud deployment flow.

Do not use the unofficial/third-party Rust `google_genai` crate unless the user later explicitly chooses it. Rust has a perfectly adequate HTTP stack and this app makes a single non-interactive inference call.

## Endpoint style

Prefer the current official `generateContent` REST API for this project because the task is one-shot/non-interactive. Before implementation, re-open the official docs in `SOURCES.md` because Gemini request fields evolve.

Authentication: `x-goog-api-key` header.

Default model setting: `gemini-3.8-flash`.

Model ID is a persisted user setting, not a hard-coded invariant.

## Structured output

Use the current official structured JSON output mechanism and provide a JSON Schema matching `DOMAIN_AND_SCHEMA.md`.

Do not prompt the model to “return JSON in a code block”. The HTTP request must request JSON output at the API level.

Still deserialize into strong Rust types and run semantic validation.

## Prompt layers

Maintain three layers:

1. **System analysis prompt** — versioned application resource. Defines the interpretation framework and output semantics.
2. **Schema** — machine-enforced output contract.
3. **Optional user custom instruction** — small free-text field appended as a bounded customization, not a replacement for the safety/contract prompt.

Persist a `prompt_version` with each analysis so later prompt changes do not make old results ambiguous.

## Request policy

- Non-streaming.
- Bounded timeout.
- Bounded retry policy only for transient failures (`429`, selected `5xx`, network timeout); never unbounded retry loops.
- Generate a request ID locally for logs.
- Never log API key.
- Do not log the full poem by default. Log document ID, source length/unit count, model, duration, status, and validation outcome.
- Do not silently truncate the text.

## Error classes to surface

At minimum distinguish:

- missing API key;
- invalid/unauthorized API key;
- quota/rate limit;
- model unavailable/not found;
- provider request too large;
- network/timeout;
- provider server error;
- malformed structured response;
- semantic validation failure;
- local persistence failure.

The UI does not need provider-internal stack traces. Logs may contain technical cause chains, excluding secrets/content.

## Billing assumption

The application has no concept of Google AI subscription tiers. It accepts a Gemini API key. Free-tier eligibility/rate limits are external account concerns. Do not wire Google AI Plus/Pro/Ultra state into the application.
