# Task 00 — audit repository and install agent scaffold

Execute this task only. Do not begin product implementation yet.

## Goal

Understand the actual repository and install/merge the project agent configuration from `_agent-bootstrap/templates` so both Antigravity and Codex-style agents can use the same guardrails.

## Step 1 — inspect before touching

Report a compact inventory, then act:

- `git status --short` and current branch;
- repository tree at a useful depth;
- package-manager lockfiles and selected package manager;
- `package.json` scripts/dependencies;
- `src-tauri/Cargo.toml` dependencies/features;
- Tauri config/capabilities;
- TypeScript/Vite config;
- existing `AGENTS.md`, `GEMINI.md`, `.agents`, `.agent`, `.gemini` customizations;
- existing `components.json` / shadcn setup;
- existing logging dependencies;
- existing SQLite/storage setup.

Do not “normalize” working configuration just because it differs from the kit.

## Step 2 — install/merge agent files

Merge, do not blindly overwrite:

- `_agent-bootstrap/templates/AGENTS.md` → repository root `AGENTS.md`;
- `_agent-bootstrap/templates/rules/*.md` → `.agents/rules/`;
- `_agent-bootstrap/templates/skills/*` → `.agents/skills/`;
- shadcn MCP config from the template/requirements below → `.agents/mcp_config.json`.

If equivalent project rules already exist, reconcile them into a single coherent result. Preserve unrelated existing MCP servers.

## Step 3 — shadcn MCP config

Ensure workspace `.agents/mcp_config.json` contains the official shadcn stdio server without deleting other servers:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

This path/schema is the current Antigravity workspace convention. If current official docs disagree, follow the current official docs and document the change.

Do not run shadcn project initialization in this task; that belongs to Task 01 after the repository audit.

## Step 4 — verify discovery

Validate that:

- root `AGENTS.md` points agents to `.agents/skills/tiger-style/SKILL.md` for code changes;
- `.agents/skills` contains tiger-style, animejs, rust-tauri-guardrails, gemini-structured-output, observability-debugging, structural-refactor;
- there is no spec-locked TDD rule/skill wired into this project;
- `.agents/mcp_config.json` remains valid JSON.

## Stop condition

Stop after the agent scaffold is installed/merged. Give a short summary of repository facts and files changed. Do not install application dependencies and do not start implementing product features.
