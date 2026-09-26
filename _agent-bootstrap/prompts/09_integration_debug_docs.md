# Task 09 — full integration pass, debug from logs, and write project documentation

Execute only this task.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `.agents/skills/observability-debugging/SKILL.md`
- `_agent-bootstrap/specs/QUALITY_GUARDRAILS.md`
- `_agent-bootstrap/specs/LOGGING_DEBUGGING.md`

## Full smoke path

Run the real app through `dev:logged` and exercise, in order:

1. launch app;
2. create/open local document;
3. paste/edit poem;
4. save;
5. configure/check Gemini key without exposing it;
6. analyze;
7. switch metrics;
8. hover/click nodes/movements;
9. collapse editor;
10. drag an override and reset it;
11. create a group/family;
12. restart and confirm persistence;
13. trigger one controlled error path such as missing key or bad model setting and confirm useful UI/logging.

If a real Gemini key is unavailable, fully smoke all local behavior and the clean missing-key path; do not invent success data outside explicit development fixtures.

## Debugging

For any failure, use the bounded log-reading protocol. Do not read the whole log first. Correlate Gemini failures by request ID. Apply smallest coherent fixes.

## Quality gates

Frontend: use the repository's actual formatter/lint/typecheck/build scripts.

Rust:

- `cargo fmt --check`
- `cargo clippy -- -D warnings`
- `cargo check`

Fix warnings instead of globally suppressing them unless a narrow suppression has a documented reason.

## Documentation to create/update

Create concise repository docs, preferably under `docs/`:

- `architecture.md` — actual final module boundaries/data flow;
- `gemini-analysis.md` — model setting, prompt version, structured schema, error behavior;
- `graph.md` — metric/movement semantics and interaction behavior;
- `debugging.md` — `dev:logged`, log paths, diagnostic commands, safe log protocol;
- root README section — how to run locally and where to set API key through the UI.

Document the implementation that exists, not a hypothetical roadmap.

## Stop

Do not add new product features in this task.
