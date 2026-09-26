# Task 11 — replace free-form Gemini model ID with a live model catalog select

Execute only this task. Do not expand product scope.

This task is an amendment to the existing Gemini/settings implementation. Inspect the current repository first and adapt to what actually exists; do not assume file names from this prompt if the project already chose equivalent boundaries.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `.agents/skills/rust-tauri-guardrails/SKILL.md`
- `.agents/skills/gemini-structured-output/SKILL.md`
- `.agents/skills/observability-debugging/SKILL.md`
- `_agent-bootstrap/specs/GEMINI.md`
- `_agent-bootstrap/specs/ARCHITECTURE.md`

## Goal

Replace the free-form Gemini model-ID input in Settings with a select populated from the Gemini API itself.

The UI must show, for each usable text-generation model:

- human-readable display name;
- canonical model ID;
- whether the model currently has a **Standard Gemini API Free Tier**;
- input context limit when returned by the API;
- a small `thinking` capability indicator only if it helps the existing UI.

The model catalog must be fetched through the Rust/Tauri backend using the already stored Gemini API key. Never expose the key to the frontend.

## Fresh-doc requirement

Before coding, verify the current official docs. Current docs win over this file if Google changed the API.

Use these official sources:

- Models API: https://ai.google.dev/api/models
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Gemini API rate limits: https://ai.google.dev/gemini-api/docs/rate-limits

Research snapshot for this task: **2026-09-26**.

## Important API fact

`GET https://generativelanguage.googleapis.com/v1beta/models` returns model metadata but **does not return pricing or Free/Paid tier metadata**.

The documented `Model` resource contains fields such as:

- `name`
- `baseModelId`
- `version`
- `displayName`
- `description`
- `inputTokenLimit`
- `outputTokenLimit`
- `supportedGenerationMethods`
- `thinking`
- sampling defaults such as `temperature`, `topP`, `topK`, `maxTemperature`

Therefore:

1. use `models.list` as the live source of truth for models exposed by the API/key;
2. use a small explicit local billing metadata catalog as the source of truth for `free-tier` vs `paid-only`;
3. classify newly returned/unrecognized models as `unknown` rather than guessing;
4. do not send probe generation requests to every model to infer billing status — that wastes quota and may incur charges on a paid project;
5. do not scrape the pricing HTML at runtime.

## Rust model-list client

Add or extend the Gemini provider service with a method equivalent to `list_models`.

Use the same HTTP client/auth policy as the existing Gemini integration.

Request:

```text
GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000
x-goog-api-key: <stored API key>
```

Handle `nextPageToken` correctly even though one page will normally be enough. Keep pagination bounded.

Deserialize only fields the application actually needs. Do not model the entire provider response unnecessarily.

Suggested provider DTO shape conceptually:

```text
GeminiApiModel
- name
- base_model_id
- version
- display_name
- description
- input_token_limit
- output_token_limit
- supported_generation_methods
- thinking
```

Normalize `models/gemini-3.8-flash` to canonical ID `gemini-3.8-flash` at the domain boundary.

## Candidate filtering

This application performs poem/text analysis with normal `generateContent` structured text output.

Only expose models that:

- support `generateContent` according to `supportedGenerationMethods`;
- are Gemini-family models (`gemini-*`);
- are appropriate for text-output analysis.

Exclude obvious specialized output families that are irrelevant here, including image generation, TTS, transcription, Live/audio-only, embedding, music/video generation, and similar specialized endpoints.

Keep this filtering in one named function such as `is_text_analysis_candidate`, with a compact explanation. Do not scatter string checks through the codebase.

An unknown future `gemini-*` text model that supports `generateContent` may still be shown with billing status `unknown` if it passes the candidate filter.

## Billing metadata model

Use explicit semantics, for example:

```text
BillingAvailability
- FreeTierAvailable
- PaidOnly
- Unknown
```

Important: `FreeTierAvailable` means the model has a Standard Gemini API free tier according to Google's pricing docs. It does **not** guarantee that a request is free if the user's API project itself is on a paid billing tier.

Do not attempt to infer the user's project billing tier from `models.list`; that information is not present there.

### Official pricing snapshot to seed the catalog

Before committing, re-check the live pricing page. At the 2026-09-26 snapshot, the relevant Standard text-generation models are:

Free tier available:

- `gemini-3.8-flash`
- `gemini-3.7-flash`
- `gemini-3.6-flash`
- `gemini-3.5-flash`
- `gemini-3.5-flash-lite`
- `gemini-3.1-flash-lite`
- `gemini-3-flash-preview` if it is still returned by `models.list`
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`

Paid-only for Standard Gemini API:

- `gemini-3.1-pro-preview`
- `gemini-3.1-pro-preview-customtools`

Do not add image/audio/live/TTS variants to the text-analysis select even when they have a free tier.

If official docs now disagree with this snapshot, update the catalog to current official values and record the new verification date.

Keep this billing catalog centralized in one small provider/domain file. Include:

- model ID;
- billing availability;
- `verified_at` date or a module-level verification-date constant;
- official pricing URL in a concise comment/doc field.

Unknown model IDs must remain `Unknown`; never classify based on naming intuition such as `flash = free` or `pro = paid`.

## Tauri boundary

Expose one thin typed command, or extend an existing settings/provider command, returning a frontend-safe model catalog.

Suggested result shape conceptually:

```text
GeminiModelOption
- id
- display_name
- input_token_limit
- output_token_limit
- thinking
- billing_availability
```

Stable application errors must distinguish at least:

- missing API key;
- unauthorized/invalid key;
- network/timeout;
- provider failure;
- malformed model-list response.

Do not return raw secret-bearing provider dumps to the UI.

## Settings UI

Replace the existing model text input with a proper select.

Behavior:

- disabled/empty-key state: explain that an API key is required to load models;
- once a key is stored, fetch the model catalog;
- refresh the catalog when the API key changes successfully;
- include a subtle manual Refresh action;
- loading state must not erase the currently persisted model;
- if catalog fetch fails, keep the previous persisted model visible and show a small retryable error;
- do not restore a free-form model text field as a fallback.

Render options approximately as:

```text
Gemini 3.8 Flash        Free tier        1M context
Gemini 3.7 Flash        Free tier        1M context
Gemini 3.1 Pro Preview  Paid only        1M context
Future Model            Unknown          1M context
```

Use the app's existing monochrome design language. Billing state can be a restrained badge/text suffix; do not introduce colorful SaaS-style pills.

Prefer `Free tier` / `Paid only` / `Unknown` labels. Add a tooltip/help text clarifying that `Free tier` means “Google offers a free API tier for this model; actual billing still depends on the API project's tier.”

### Sorting

Sort predictably:

1. currently selected model first if appropriate;
2. free-tier models before paid-only models;
3. paid-only before unknown;
4. within a category, prefer newer/high-capability models first using one small explicit preference list rather than fragile semantic-version parsing.

A reasonable preference order at this snapshot is:

```text
gemini-3.8-flash
gemini-3.7-flash
gemini-3.6-flash
gemini-3.5-flash
gemini-3.5-flash-lite
gemini-3.1-flash-lite
gemini-3-flash-preview
gemini-2.5-pro
gemini-2.5-flash
gemini-2.5-flash-lite
gemini-3.1-pro-preview
```

Unknown models can follow alphabetically by display name.

### Default and stale selection policy

- For a fresh install with no model configured, prefer `gemini-3.8-flash` **only if it is present in the live returned catalog**.
- Otherwise choose the first returned free-tier candidate.
- Otherwise choose the first returned candidate.
- Never silently replace an already persisted user selection merely because a refresh temporarily fails.
- If a previously selected model is no longer returned after a successful refresh, preserve it as an explicit disabled/unavailable entry and require the user to choose another model before the next analysis. Do not silently switch models behind the user's back.

## Analyze-flow integration

The existing analysis request must continue to use the persisted selected model ID.

Before analysis, reject a model that is known from a successful catalog refresh to be unavailable. Preserve the existing provider-side model-not-found handling as a second line of defense.

Do not add any per-analysis billing logic.

## Logging

Log, without secrets:

- model-list request correlation ID;
- status/latency;
- number of raw models returned;
- number of text-analysis candidates;
- number classified free-tier / paid-only / unknown;
- selected model changes;
- catalog refresh failure kind.

Do not log the API key or full provider response.

## Documentation

Update the project's Gemini/settings documentation with a short section explaining:

- model options are fetched live from `models.list`;
- the API response does not contain pricing metadata;
- billing badges come from a small verified local metadata catalog;
- unknown future models are intentionally labeled `Unknown`;
- the verification date and official pricing URL.

Do not write a long architecture essay.

## Verification

Run existing frontend/Rust quality gates and perform these smoke checks:

1. no API key -> model select shows clean missing-key state;
2. invalid API key -> clear unauthorized state;
3. valid key -> live models load from `models.list`;
4. only appropriate Gemini text-generation candidates are shown;
5. `gemini-3.8-flash` is rendered as Free tier when returned and current docs still say so;
6. `gemini-3.1-pro-preview` is rendered as Paid only when returned and current docs still say so;
7. an unmapped future model is rendered as Unknown, not guessed;
8. saved model survives restart;
9. changing the API key triggers a refresh;
10. failed refresh does not destroy the previous selected model;
11. analysis uses the newly selected model;
12. logs contain catalog diagnostics but no API key.

Do not send test `generateContent` requests to every model. One existing normal analysis smoke test is enough if a key is available.

## Stop condition

Stop when the free-form model input has been replaced by the live, classified model select; documentation and quality gates are updated; and the smoke checks above pass or any externally blocked check is reported precisely.

Do not start unrelated UI refactors.
