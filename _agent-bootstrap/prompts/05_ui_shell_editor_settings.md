# Task 05 — build the application shell, text editor, settings, and local document flow

Execute only this task.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `_agent-bootstrap/specs/PRODUCT.md`
- `_agent-bootstrap/specs/UI_GRAPH.md`
- `_agent-bootstrap/specs/ARCHITECTURE.md`

Use the shadcn MCP when it saves time, but keep the UI bespoke and restrained.

## Visual direction

Monochrome editorial desktop tool. No logo. No hero. No gradient. No dashboard-card wall. Avoid excessive border radius.

## Build the working shell

Required:

- document title/editable title;
- plain text editor optimized for paste/write;
- Analyze button with clear pending state;
- graph workspace placeholder that will be replaced in Task 06;
- editor pane collapsible so graph area can become effectively full-width;
- minimal local documents/recent-documents access if persistence already supports it;
- status/error area that does not dominate the UI.

No file import UI.

## Settings

Provide a compact settings surface for:

- Gemini API key: set/replace/delete/status, never show full stored key after saving;
- Gemini model ID, defaulting to current configured value;
- optional custom analysis instruction;
- perhaps logging level in development only if already easy; do not build a settings framework.

Complete secure API-key persistence now if Task 02 left it abstract. Prefer OS credential storage. Do not store the key in SQLite/localStorage.

## Analyze flow

Wire editor -> unitization -> typed Tauri command -> pending/success/error state -> save result. Graph can still be a temporary structural placeholder, but successful analysis data must reach frontend state cleanly.

Do not discard the last valid analysis while a new analysis is running or if it fails.

## Error UX

Show concise distinctions for missing key, unauthorized key, quota/rate limit, model unavailable, oversized request, timeout/network, invalid analysis, and generic local persistence errors.

## Verification

Smoke:

- create/open/edit/save local document;
- collapse/expand editor;
- save/reload settings;
- analyze button missing-key failure path;
- real analysis if key is locally available;
- restart app and confirm local document/settings state behaves correctly.

Inspect logs and run quality gates.
