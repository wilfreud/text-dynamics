---
name: structural-refactor
description: Use near the end of implementation or when generated code has structural hotspots. Refactor by semantic responsibility and coupling while preserving behavior; never split files merely to hit a line-count target.
---

# Structural refactor — project edition

Adapted from the user's structural-refactor skill.

## Audit first

Look for:

- god components/modules with multiple reasons to change;
- duplicated graph/domain calculations;
- IPC strings scattered across UI;
- provider DTOs leaking everywhere;
- persistence mixed into rendering;
- repeated error mapping;
- circular imports or bidirectional feature coupling;
- files that are large because of cohesive data/schema definitions versus files that are large because responsibilities are mixed.

Line count is a signal, not a verdict.

## Refactor rules

- Preserve observable behavior.
- Move along semantic seams that already exist.
- Prefer one clear owner for each concept.
- Do not create a maze of tiny one-function files.
- Remove dead abstractions and unused dependencies after the move.
- Run quality gates and smoke the affected workflow.

## Source

https://github.com/wilfreud/skills-or-something/tree/main/structural-refactor
