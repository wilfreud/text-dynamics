# Task 03 — implement text unitization, domain types, analysis prompt, and structured schema

Execute only this task.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `.agents/skills/gemini-structured-output/SKILL.md`
- `_agent-bootstrap/specs/DOMAIN_AND_SCHEMA.md`
- `_agent-bootstrap/specs/ANALYSIS_PROMPT.md`
- `_agent-bootstrap/specs/PRODUCT.md`

## 1. Deterministic frontend unitization

Implement a pure TypeScript unitizer for pasted/edited source text.

Requirements:

- preserve original source exactly;
- produce stable ordered unit IDs such as `u0001`;
- physical non-empty lines are the default text units for poetry;
- preserve blank-line/stanza information locally;
- keep exact source offsets suitable for `textarea.setSelectionRange()` in JavaScript/UTF-16 indexing;
- no model-generated offsets;
- no artificial character limit.

Do not split every sentence with a heavy NLP dependency.

## 2. Rust domain types

Implement strong serializable/deserializable types for:

- analysis request units;
- segments;
- metrics;
- movements and movement enum;
- phases and phase enum;
- overall analysis;
- analysis result metadata;
- user overrides/groups where useful now.

## 3. Semantic validation

Implement validation specified in `DOMAIN_AND_SCHEMA.md` after deserialization. Return typed errors. Do not silently repair unknown IDs or overlaps.

## 4. JSON Schema

Create one authoritative schema builder/constant for the Gemini structured response. Keep it near the provider/domain boundary and aligned with Rust types.

Avoid maintaining two unrelated schemas by hand if a small clear approach can keep them synchronized. However, do not add a large schema-generation framework solely for this.

## 5. Versioned analysis prompt

Add the prompt from `_agent-bootstrap/specs/ANALYSIS_PROMPT.md` as a versioned application resource/module. Define an explicit prompt version such as `text-dynamics-1`.

Allow a future/custom user instruction to be appended as a clearly delimited addition without replacing the core contract.

## 6. No provider call yet

This task should compile the domain, schema, prompt, and unitization path. Do not make the network request yet.

## Verification

Run quality gates. Manually inspect unitization with a French poem containing accents, punctuation, blank lines, and emoji/non-BMP characters to ensure local JS selection offsets stay correct. This is a smoke check, not a request to introduce a test framework.
