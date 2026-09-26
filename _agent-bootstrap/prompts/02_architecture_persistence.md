# Task 02 — establish modular app architecture and local persistence

Execute only this task.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `.agents/skills/rust-tauri-guardrails/SKILL.md`
- `_agent-bootstrap/specs/PRODUCT.md`
- `_agent-bootstrap/specs/ARCHITECTURE.md`
- `_agent-bootstrap/specs/QUALITY_GUARDRAILS.md`

## Goal

Create the smallest clean module structure that can support the product without implementing the graph or Gemini call yet.

## Frontend

Establish feature boundaries for:

- documents/local persistence UI adapter;
- editor;
- analysis;
- settings;
- graph submodule placeholder;
- typed Tauri IPC adapter;
- logging.

Do not create dozens of empty files. Create modules when they have real code/responsibility.

## Rust

Create/wire coherent modules for:

- commands;
- app error mapping;
- document/analysis persistence;
- settings/secrets boundary;
- analysis capability;
- Gemini adapter placeholder/interface at the module level;
- observability.

Keep `lib.rs` focused on Tauri/plugin/state/command registration.

## SQLite

Implement a tiny local schema and migration/bootstrap path. Prefer Rust-owned SQLite. If the repository already has a valid SQLite approach, keep it.

Minimum persisted concepts:

### documents

- id
- title
- content
- created_at
- updated_at

### analyses

- id
- document_id
- schema_version
- model_id
- prompt_version
- raw/base validated analysis JSON
- created_at

### analysis_overrides

- analysis_id
- overrides JSON
- updated_at

Simple JSON payload columns are acceptable for analysis/overrides; do not prematurely normalize every segment into SQL tables.

Add foreign keys/indexes that are obviously useful. Use a schema version/migration mechanism instead of ad-hoc `CREATE TABLE` calls scattered around commands.

## API key persistence boundary

Create the settings/secrets abstraction, but do not store the Gemini key in SQLite. Prefer the OS credential store implementation if it can be added cleanly now; otherwise wire the boundary and finish the concrete secure storage in Task 05. Never commit a real key.

## IPC commands

Implement only the local commands needed to prove the architecture/persistence works, such as:

- create/update/read/list local documents;
- get/save non-secret settings;
- key presence status if secret adapter is already concrete.

Keep command handlers thin.

## Verification

Run frontend and Rust quality gates, then smoke the local document persistence path. Check logs for errors. Do not implement Gemini analysis or graph rendering in this task.
