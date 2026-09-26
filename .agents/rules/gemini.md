---
trigger: model_decision
description: Apply when implementing or debugging Gemini API calls, schemas, prompts, model configuration, or provider errors.
---

Before modifying Gemini integration, read `.agents/skills/gemini-structured-output/SKILL.md` and `_agent-bootstrap/specs/GEMINI.md`.

Fetch current official Gemini API documentation before relying on remembered request fields. Use structured output at the API level, then semantic validation locally. Do not introduce Vertex AI or a third-party Rust Gemini SDK for this project unless explicitly requested.
