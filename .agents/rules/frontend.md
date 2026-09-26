---
trigger: glob
description: React and frontend implementation rules.
globs: "src/**/*.ts, src/**/*.tsx, src/**/*.css"
---

- Prefer feature-local modules and derived state over duplicated global state.
- Do not put Gemini HTTP/auth logic in the webview.
- Keep Tauri command names behind a small typed frontend adapter.
- Graph rendering code must separate domain data, effective values, geometry projection, rendering, and interaction state.
- Do not use animation as domain state.
- Preserve exact text locally; never replace source text with model-generated excerpts.
- Use shadcn primitives selectively and preserve the monochrome editorial visual direction.
- Avoid mega-components. Split only on semantic responsibility, not arbitrary line counts.
