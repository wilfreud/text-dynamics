# Architecture specification

The architecture should be modular without pretending this personal desktop tool is an enterprise platform.

## Boundary

```text
React UI
  │
  │ Tauri invoke commands
  ▼
Thin Rust commands
  ▼
Application services
  ├── Gemini adapter (HTTP)
  ├── persistence adapter (SQLite)
  └── secret adapter (OS credential store)
```

The frontend must not know SQL or Gemini HTTP details. Tauri commands are an IPC boundary, not a place for business logic.

## Suggested frontend shape

Adapt to the existing repo instead of forcing exact names.

```text
src/
  app/
    App.tsx
    providers/
  components/
    ui/                 # shadcn generated components
  features/
    documents/
    editor/
    analysis/
      components/
      graph/
        GraphViewport.tsx
        graphGeometry.ts
        graphPath.ts
        graphTypes.ts
        interactions.ts
      unitization/
      state/
    settings/
  lib/
    logging/
    tauri/
  styles/
```

Prefer feature-local components over a giant global `components/` dumping ground.

## Suggested Rust shape

```text
src-tauri/src/
  lib.rs
  error.rs
  state.rs
  commands/
    analysis.rs
    documents.rs
    settings.rs
  analysis/
    model.rs
    service.rs
    validation.rs
    prompt.rs
  gemini/
    client.rs
    dto.rs
  persistence/
    db.rs
    documents.rs
    analyses.rs
  secrets/
    keyring.rs
  observability/
    mod.rs
```

If the current repository already has a sensible structure, preserve it and map responsibilities to it rather than performing churn.

## Dependency direction

- UI imports feature/domain projections, not low-level IPC strings everywhere.
- One small frontend Tauri client module owns `invoke()` command names.
- Rust command handlers call service functions.
- Service functions depend on adapters through small concrete modules; do not introduce trait abstractions unless two implementations or a real seam justify them.
- HTTP DTOs from Gemini are not frontend state models by accident.

## State

Avoid a state library unless the repo already has one or React state becomes genuinely awkward. Derived graph state should be computed from the analysis + overrides, not copied into multiple stores.

## No dependency theater

Do not install a graph framework, ORM, dependency-injection framework, Redux, or async database framework just because they are common. Add dependencies only for a concrete requirement.
