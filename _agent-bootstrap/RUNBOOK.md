# Copy/paste runbook

The task files are intentionally more precise than these launcher prompts. Paste **one launcher prompt at a time** into the coding agent.

## 00 — repository audit + agent scaffold

`Read _agent-bootstrap/prompts/00_repo_audit_agent_bootstrap.md and execute it completely. Before editing code, also read _agent-bootstrap/templates/skills/tiger-style/SKILL.md. Do not execute later task files.`

## 01 — dependencies, shadcn, MCP, logging harness

`Read _agent-bootstrap/prompts/01_dependencies_ui_logging.md and execute it completely. Follow AGENTS.md and load tiger-style plus observability-debugging. Do not execute later task files.`

## 02 — application architecture + local persistence

`Read _agent-bootstrap/prompts/02_architecture_persistence.md and execute it completely. Follow AGENTS.md and load tiger-style plus rust-tauri-guardrails. Do not execute later task files.`

## 03 — text dynamics domain + Gemini contract

`Read _agent-bootstrap/prompts/03_domain_gemini_contract.md and execute it completely. Follow AGENTS.md and load tiger-style plus gemini-structured-output. Do not execute later task files.`

## 04 — Gemini REST integration in Rust

`Read _agent-bootstrap/prompts/04_gemini_rust_integration.md and execute it completely. Follow AGENTS.md and load tiger-style, rust-tauri-guardrails, and gemini-structured-output. Do not execute later task files.`

## 05 — application shell, editor, settings, local documents

`Read _agent-bootstrap/prompts/05_ui_shell_editor_settings.md and execute it completely. Follow AGENTS.md and load tiger-style. Use the shadcn MCP when useful. Do not execute later task files.`

## 06 — custom graph rendering engine

`Read _agent-bootstrap/prompts/06_graph_rendering_engine.md and execute it completely. Follow AGENTS.md and load tiger-style. Do not execute later task files.`

## 07 — graph interactions, overrides, grouping, text sync

`Read _agent-bootstrap/prompts/07_interactions_overrides.md and execute it completely. Follow AGENTS.md and load tiger-style. Do not execute later task files.`

## 08 — motion and visual polish

`Read _agent-bootstrap/prompts/08_animation_polish.md and execute it completely. Follow AGENTS.md and load tiger-style plus animejs. Do not execute later task files.`

## 09 — integration, debugging, documentation

`Read _agent-bootstrap/prompts/09_integration_debug_docs.md and execute it completely. Follow AGENTS.md and load tiger-style plus observability-debugging. Do not execute later task files.`

## 10 — final structural audit

`Read _agent-bootstrap/prompts/10_final_audit.md and execute it completely. Follow AGENTS.md and load tiger-style plus structural-refactor. Do not add new product scope.`

## Reusable repair prompt

`Read _agent-bootstrap/prompts/99_repair_from_logs.md. Diagnose the current failure using the repository state and logs, apply the smallest correct fix, and stop.`

## 11 — live Gemini model catalog + Free/Paid labels

`Read _agent-bootstrap/prompts/11_dynamic_gemini_model_catalog.md and execute it completely. Follow AGENTS.md and load tiger-style, rust-tauri-guardrails, gemini-structured-output, and observability-debugging. Replace the Gemini model text input with the live classified select and stop when this task is complete.`
