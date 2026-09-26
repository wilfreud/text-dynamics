# Quality guardrails

This project deliberately skips a TDD workflow, but it does not skip engineering discipline.

## Every code task

- Read the current repository before editing.
- Preserve the package manager selected by its lockfile.
- Inspect `package.json`, `src-tauri/Cargo.toml`, Tauri config, existing aliases, lint config, and shadcn `components.json` before adding dependencies/config.
- Use the `tiger-style` skill as the default reliability guardrail.
- Validate external input at boundaries.
- Prefer explicit typed errors to swallowed failures.
- Keep functions/modules semantically cohesive.
- Do not create abstractions in anticipation of hypothetical future scale.
- Do not add dependencies when a small clear local helper is sufficient.
- Never use a giant `App.tsx` or `lib.rs` as the feature implementation.

## Verification instead of TDD

Unless explicitly asked otherwise, completion evidence is:

Frontend:

- formatter if configured;
- lint if configured;
- TypeScript check/build;
- application smoke run.

Rust:

- `cargo fmt --check`;
- `cargo clippy -- -D warnings`;
- `cargo check`;
- application smoke run.

Runtime:

- inspect bounded logs;
- manually exercise the changed user path.

Do not scaffold Jest/Vitest/Playwright/Cypress just to satisfy a generic checklist.

## Documentation

When changing a persistent data shape, Gemini contract, graph behavior, or architecture boundary, update the corresponding project documentation in the same task.
