---
trigger: model_decision
description: Apply when a dev command, build, runtime action, Gemini request, or UI interaction is failing.
---

Read `.agents/skills/observability-debugging/SKILL.md`.

Start from the failing command and bounded log context. Prefer `tail -n 80 logs/dev.latest.log` or a targeted search. Expand context only after forming a hypothesis. Fix root causes, not symptoms, and avoid unrelated refactors during incident repair.
