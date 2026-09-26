# Text Dynamics — Architecture

## Overview

Text Dynamics is a local-first desktop application built with **Tauri v2**, **Rust**, and **React 19** for visualizing and interactively editing the dynamic emotional, structural, and semantic architecture of literary texts and poetry.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                               React 19 UI                               │
│  ┌───────────────────────┬───────────────────────────────────────────┐  │
│  │      Text Editor      │              Graph Viewport               │  │
│  │  Collapsible plain    │   Custom SVG Semantic Graph Engine        │  │
│  │  text editor with     │   - Ordered Segment Nodes                 │  │
│  │  line gutter & caret  │   - Discontinuous Semantic Paths          │  │
│  │  tracking             │   - Phase Bands & Movement Markers        │  │
│  └───────────────────────┴───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │   Inspectors & Overrides: Segment, Movement, and Group Manager    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Tauri IPC invoke()
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Rust Command Layer                            │
│  analyze_document | get_latest_analysis | save_analysis_overrides       │
│  create_document  | update_document     | delete_document | list_docs   │
│  has_api_key      | set_api_key         | delete_api_key                │
│  get_setting      | save_setting                                        │
└──────────────────┬─────────────────┬──────────────────┬─────────────────┘
                   │                 │                  │
                   ▼                 ▼                  ▼
          ┌────────────────┐ ┌───────────────┐ ┌────────────────┐
          │  Gemini REST   │ │ SQLite Engine │ │ OS Credential  │
          │    Adapter     │ │ (Documents &  │ │ Store (Keyring │
          │  (HTTP client) │ │   Analyses)   │ │  Mac Keychain) │
          └────────────────┘ └───────────────┘ └────────────────┘
```

---

## 1. System Boundaries & Invariants

1. **Frontend Boundary**:
   - The frontend owns UI presentation, user interactions, and deterministic text unitization.
   - The frontend does not write raw SQL or make direct HTTP calls to Gemini. All database, network, and credential operations pass through typed Tauri IPC commands.
2. **Persistence Boundary**:
   - SQLite (`rusqlite` bundled) stores documents, analyses, user overrides, and non-sensitive settings locally.
   - The Gemini API key is **never** written to SQLite or localStorage.
3. **Secret Storage Boundary**:
   - The Gemini API key is stored exclusively in the host OS credential store (`keyring` crate backed by `security-framework` on macOS / Windows Credential Manager / Secret Service on Linux).
4. **AI Base vs. User Truth**:
   - Canonical AI analyses are stored immutably.
   - User edits (dragged metric overrides, movement kind overrides, named groups) are stored in an independent `overrides` layer.
   - The effective value rendered is strictly `user_override ?? ai_value`.
   - New analyses initialize with a clean override layer.

---

## 2. Frontend Structure (`src/`)

```text
src/
├── App.tsx                     # Top-level application orchestrator
├── main.tsx                    # Entrypoint & logging initialization
├── index.css                   # Tailwind v4 theme, Geist font, design tokens
├── components/
│   ├── Header.tsx              # Document title, switcher trigger, analyze CTA, settings
│   ├── StatusBar.tsx           # Save indicator, counts, model indicator, error notices
│   └── ui/                     # Restrained shadcn primitives (Button, Dialog, Input, Textarea)
├── features/
│   ├── documents/              # Local SQLite document management
│   │   ├── DocumentSwitcher.tsx# Document list, switching, and creation
│   │   ├── documentService.ts  # Document IPC wrapper
│   │   └── types.ts            # Document models
│   ├── editor/                 # Text editor with deterministic selection sync
│   │   ├── TextEditor.tsx      # Gutter, textarea, selection sync, caret tracking
│   │   └── types.ts            # Editor state types
│   ├── settings/               # Application & provider settings
│   │   ├── SettingsDialog.tsx  # API key management (OS Keychain) & model config
│   │   ├── settingsService.ts  # Settings IPC wrapper
│   │   └── types.ts            # Settings models
│   └── analysis/               # Domain analysis & Graph Engine
│       ├── types.ts            # CanonicalAnalysis, Segment, Movement, Phase
│       ├── analysisService.ts  # Analysis IPC calls & overrides persistence
│       ├── unitization/        # Deterministic text unitization
│       │   └── unitizer.ts     # Source line unitization with exact UTF-16 offsets
│       └── graph/              # Custom SVG graph engine
│           ├── graphTypes.ts   # View model, viewport, and metric definitions
│           ├── effectiveAnalysis.ts # Pure layer: AI base + overrides
│           ├── graphGeometry.ts# Projection, Y-inversion, unprojectY, and grid
│           ├── graphPath.ts    # Truthful semantic path generation
│           ├── graphViewModel.ts# Domain-to-graph projection
│           ├── graphAnimation.ts# Scoped Anime.js lifecycle motion
│           ├── GraphRenderer.tsx# Pure SVG renderer with node dragging
│           ├── GraphViewport.tsx# Container with ResizeObserver & metric selectors
│           ├── GraphTooltip.tsx # High-contrast floating node/movement tooltip
│           ├── SegmentInspector.tsx # Segment metrics editor & reset-to-AI
│           ├── MovementInspector.tsx# Movement kind editor & reset-to-AI
│           └── GroupManager.tsx # Multi-selection grouping into named families
└── lib/
    ├── errors.ts               # Categorized user-friendly error parser
    ├── logging/                # LogTape logger with redaction and Tauri bridge
    └── tauri/ipc.ts            # Strongly typed Tauri invoke wrappers
```

---

## 3. Rust Backend Structure (`src-tauri/src/`)

```text
src-tauri/src/
├── lib.rs                      # Tauri application builder & command registration
├── main.rs                     # Desktop binary entrypoint
├── error.rs                    # AppError enum with structured serialization
├── state.rs                    # Managed AppState (DbConnection, KeyringStore, reqwest::Client)
├── analysis/
│   ├── model.rs                # CanonicalAnalysis, Segment, Movement, Phase DTOs
│   ├── prompt.rs               # Versioned system prompt & schema definition
│   ├── service.rs              # Analysis orchestration (unitize, fetch, validate, store)
│   ├── unitize.rs              # Rust-side source unitization
│   └── validation.rs           # Strict semantic and boundary validation rules
├── commands/
│   ├── mod.rs
│   ├── analysis.rs             # analyze_document, get_latest_analysis, overrides
│   ├── documents.rs            # create_document, update_document, delete_document, list
│   └── settings.rs             # get_setting, save_setting, has/set/delete_api_key
├── gemini/
│   ├── client.rs               # Direct REST client with exponential backoff & retries
│   └── dto.rs                  # Gemini REST request and response structures
├── persistence/
│   ├── db.rs                   # SQLite migration runner & connection manager
│   ├── documents.rs            # Document queries & mutations
│   └── analyses.rs             # Analyses and user overrides tables
└── secrets/
    └── keyring.rs              # OS Keychain / Credential store integration
```

---

## 4. Key Data Flow

```text
[User Pastes Text]
       │
       ▼
[unitizeText()] ─── Exact UTF-16 Line Units ───► [Rust: analyze_document]
                                                        │
                                                        ▼
                                                [Gemini REST API]
                                            (Structured JSON Schema)
                                                        │
                                                        ▼
                                           [Rust Semantic Validation]
                                                        │
                                                        ▼
                                              [SQLite: analyses table]
                                                        │
[Graph Rendering] ◄─── CanonicalAnalysis ───────────────┘
       │
       ├──► [effectiveAnalysis(canonical, overrides)]
       ├──► [buildGraphViewModel()]
       └──► [GraphRenderer (SVG)] ◄─── [User Pointer Drag / Override Edit]
                                                  │
                                                  ▼
                                      [save_analysis_overrides]
                                                  │
                                                  ▼
                                      [SQLite: overrides table]
```
