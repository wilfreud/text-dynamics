---
name: tiger-style
description: Default defensive-programming guardrail for implementation and refactoring. Use for all executable code changes to make failures explicit, bound work, validate boundaries, and keep invalid states difficult to represent.
---

# Tiger-style defensive programming — pragmatic project edition

This skill is adapted for this small desktop project from the user's defensive-programming skill. It is a guardrail, not a ritual.

## Core rules

1. Validate untrusted/external data at boundaries: user IPC arguments, database rows, HTTP responses, and Gemini structured output.
2. Make invalid states hard to represent with enums/newtypes/typed structures when that improves clarity.
3. Fail loudly and locally. Do not swallow errors or substitute plausible fake data.
4. Bound work: retries, loops, payload sizes where externally constrained, and timeouts must have explicit limits.
5. Never use unbounded recursion for routine processing.
6. Keep side effects explicit. Pure projection/validation helpers are preferable where practical.
7. Use assertions for genuine programmer invariants, not recoverable user/provider failures.
8. Handle return values. Do not discard errors without a documented reason.
9. Prefer cohesive functions/modules. A function that needs several unrelated comments probably has several responsibilities.
10. Comments explain **why/invariants**, not a paraphrase of the code.

## Rust specifics

- Prefer `Result<T, E>` for recoverable failures.
- Avoid `unwrap()`/`expect()` in runtime paths; startup invariants are the narrow exception and should explain why failure is unrecoverable.
- Validate numeric ranges and IDs after deserialization.
- Avoid holding mutex/RwLock guards across `.await`.

## TypeScript specifics

- Avoid `any` unless isolated at a validated boundary.
- Narrow unknown IPC/provider data before use.
- Avoid contradictory duplicated React state; derive graph projections from canonical analysis + overrides.

## Project-specific negative space

These states must never happen silently:

- user override mutates or destroys the AI base value;
- graph point references a non-existent segment;
- Gemini segment references an unknown source unit;
- API key appears in logs/database;
- source text is silently truncated;
- a “drop” is visually smoothed into a gentle decline;
- failed analysis replaces the last valid analysis with partial garbage.

## Verification

Run the repository's existing frontend checks plus Rust fmt/clippy/check and inspect relevant runtime logs. No generic test-suite requirement is implied by this skill.

## Upstream references

- User skill: https://github.com/wilfreud/skills-or-something/tree/main/defensive-programming
- Rust validation guidance: https://rust-lang.github.io/api-guidelines/dependability.html
- Clippy: https://doc.rust-lang.org/clippy/usage.html
