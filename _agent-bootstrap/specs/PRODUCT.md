# Product specification — Poem Dynamics

## Purpose

A local desktop instrument for inspecting the **dynamic structure of a poem or free-form text**. The application is not a writing assistant and should not rewrite the text unless a future explicit feature asks for it. It visualizes one possible machine interpretation and lets the user correct that interpretation.

## Core flow

1. User creates/opens a local document.
2. User pastes or writes plain text.
3. User presses **Analyze**.
4. Frontend deterministically unitizes the text into stable line units.
5. Rust sends those units to Gemini with a strict JSON schema.
6. Rust validates both JSON structure and domain semantics.
7. Frontend renders the analysis as an interactive graph.
8. User can inspect nodes/movements, correct metric values, group selections, and reset corrections back to AI values.
9. Document, analysis, and user overrides are saved locally.

## Explicit non-goals

- No text file/PDF/DOCX import.
- No cloud database.
- No login/authentication.
- No multi-user collaboration.
- No sync.
- No analytics/telemetry.
- No mobile app.
- No publishing/export pipeline in the initial build.
- No arbitrary AI chat surface.
- No TDD ceremony or broad test suite unless explicitly requested later.
- No logo/brand exercise.

## Text input

- Plain text only.
- Paste and direct editing.
- Preserve line breaks and blank lines.
- Do not impose an arbitrary local character limit.
- Upstream model context/request limits still exist. If exceeded, show a precise provider-limit error rather than silently truncating.

## Metrics

Each semantic segment has:

- **Intensity**: `0..10`. Perceived force/impact of the segment.
- **Tension**: `0..10`. Pressure, suspense, unease, unresolved expectancy.
- **Valence**: `-10..10`. Negative/dark ↔ positive/light affective direction.
- **Temperature**: `-10..10`. Cold/detached ↔ hot/visceral expression.
- **Confidence**: `0..1`. Model confidence in the interpretation.

Intensity and temperature are intentionally independent. A cold passage can be highly intense.

## Movement vocabulary

- `crescendo`
- `decrescendo`
- `spike`
- `drop`
- `plateau`
- `oscillation`
- `rupture`
- `reversal`
- `reset`
- `sustain`

A movement can span more than two segments.

## Phase vocabulary

- `build_up`
- `climax`
- `break`
- `aftermath`
- `plateau`
- `oscillation`
- `other`

## AI versus user truth

Never overwrite the AI interpretation when the user edits it.

Maintain at least two conceptual layers:

- immutable AI/base analysis;
- user override layer.

The rendered/effective value is `user_override ?? ai_value`.

The user must be able to reset a point/movement/group to the original AI interpretation.
