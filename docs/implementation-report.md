# Text Dynamics — Final Implementation & Audit Report

This report documents the completed implementation of Text Dynamics, its architectural structure, core dependencies, data schemas, API integration, and operational characteristics as audited under Task 10.

---

## 1. Final Architecture Tree

```text
text-dynamics/
├── docs/                                # Operational documentation
│   ├── architecture.md                  # System boundaries, data flow, contracts
│   ├── gemini-analysis.md               # Gemini prompt, schema, retries, validation
│   ├── graph.md                         # Metric semantics, SVG paths, motion design
│   ├── debugging.md                     # Log pipeline, diagnostic scripts, troubleshooting
│   └── implementation-report.md         # Final audit and technical inventory
├── scripts/                             # Quality gate & diagnostic scripts
│   ├── check-frontend.sh                # Typechecking & production Vite bundling
│   ├── check-rust.sh                    # cargo fmt, clippy (-D warnings), cargo check
│   ├── debug-context.sh                 # Bounded developer log inspector
│   └── dev-with-logs.sh                 # Dual-tee logging dev launcher
├── src/                                 # Frontend (React 19 + TypeScript + Tailwind v4)
│   ├── App.tsx                          # Root workspace orchestrator & state coordinator
│   ├── components/
│   │   ├── Header.tsx                   # Document title, actions (Analyze, Switcher, Settings)
│   │   ├── StatusBar.tsx                # Dirty state, counts, model indicator, error banner
│   │   └── ui/                          # Lightweight Radix UI primitives (button, dialog, input, textarea)
│   ├── features/
│   │   ├── analysis/                    # Dynamic analysis domain & visual presentation
│   │   │   ├── analysisService.ts       # IPC bridge mapping DTOs to CanonicalAnalysis
│   │   │   ├── types.ts                 # Domain contracts (CanonicalAnalysis, Movements, Phases)
│   │   │   ├── unitization/             # Deterministic text unitizer (UTF-16 code units)
│   │   │   └── graph/                   # Custom SVG dynamic graph engine
│   │   │       ├── GraphViewport.tsx    # Responsive viewport container & toolbar
│   │   │       ├── GraphRenderer.tsx    # Primary SVG canvas, semantic paths, drag handles
│   │   │       ├── GraphTooltip.tsx     # Rich hover telemetry & rationales
│   │   │       ├── SegmentInspector.tsx # Metric sliders & segment reset controls
│   │   │       ├── MovementInspector.tsx# Movement kind overrides & span indicators
│   │   │       ├── GroupManager.tsx     # Multi-select clustering into named families
│   │   │       ├── graphAnimation.ts    # Anime.js lifecycle-safe animations (prefers-reduced-motion)
│   │   │       ├── graphGeometry.ts     # Coordinate projections (projectX, projectY, unprojectY)
│   │   │       ├── graphPath.ts         # Piecewise semantic path generator (drop/spike/rupture)
│   │   │       └── graphViewModel.ts    # Effective analysis merging (base AI ?? user overrides)
│   │   ├── documents/                   # Document switcher & persistence service
│   │   ├── editor/                      # Collapsible plain text editor with line numbers & selection sync
│   │   └── settings/                    # Model configuration, custom instructions, OS Keyring key manager
│   └── lib/
│       ├── errors.ts                    # Strongly typed AppError parsing & actionable categorization
│       ├── logging.ts                   # LogTape setup with console and Tauri log forwarders
│       └── tauri/ipc.ts                 # Centralized type-safe IPC command invocations
└── src-tauri/                           # Native Rust Backend (Tauri v2)
    ├── Cargo.toml                       # Optimized release profile & native keyring features
    └── src/
        ├── lib.rs                       # Tauri runtime initialization & IPC command registration
        ├── main.rs                      # Application entrypoint
        ├── state.rs                     # Shared AppState (Database + KeyringStore)
        ├── error.rs                     # Typed AppError enum & serde serialization
        ├── secrets/                     # Platform-native credential management (Keyring v3)
        ├── persistence/                 # Local SQLite engine (rusqlite bundled)
        │   ├── db.rs                    # Schema initialization & migrations table
        │   ├── documents.rs             # Document CRUD operations
        │   └── analyses.rs              # Immutable analysis records & override persistence
        ├── gemini/                      # Direct HTTPS Gemini REST client
        │   ├── client.rs                # Request dispatcher with exponential backoff retry loop
        │   └── schema.rs                # Strict OpenAPI/JSON schema definitions for Gemini
        ├── analysis/                    # Structural analysis processing
        │   ├── model.rs                 # Canonical domain structs matching schema
        │   ├── unitize.rs               # Server-side text unitization
        │   ├── prompt.rs                # System prompt versioning & user instruction formatting
        │   ├── validation.rs            # Semantic coverage & boundary validation rules
        │   └── service.rs               # Analysis orchestration service
        └── commands/                    # Thin IPC command handlers (documents, settings, analysis)
```

---

## 2. Key Dependencies & Rationale

### Frontend Dependencies

| Package | Purpose & Architectural Justification |
| :--- | :--- |
| **`react` / `react-dom` (v19)** | Declarative UI state management and lifecycle hooks. |
| **`@tauri-apps/api` (v2)** | Core Tauri IPC bridge (`invoke`) for communication with Rust backend. |
| **`@tauri-apps/plugin-log`** | Forwards frontend logs to the native backend logging pipeline. |
| **`animejs` (v4)** | Micro-animations for graph node entry and metric selection transitions, controlled strictly via React `useRef` handles without mutating SVG path geometry. |
| **`radix-ui` primitives** | Accessible dialogs and modals (`Dialog`, `DialogContent`) styled with monochrome editorial Tailwind tokens. |
| **`lucide-react`** | High-clarity editorial icons (minimalist chevron, activity, save, trash, check indicators). |
| **`@fontsource-variable/geist`**| Clean, variable typography ensuring consistent rendering across desktop environments. |
| **`@logtape/logtape` + `@logtape/redaction`** | Structured frontend logger with automated redacting of sensitive credential parameters. |

### Backend (Rust) Dependencies

| Crate | Purpose & Architectural Justification |
| :--- | :--- |
| **`tauri` (v2)** | Lightweight native desktop container with fast IPC and native window management. |
| **`rusqlite` (`bundled`)** | Embeds a zero-configuration SQLite engine directly into the binary; eliminates external database installation requirements. |
| **`reqwest` (`rustls-tls`, `json`)**| High-performance asynchronous HTTP client for calling Gemini directly from Rust without C-OpenSSL dynamic library dependencies. |
| **`keyring` (v3 with `apple-native` / `windows-native`)** | Stores user API keys in native platform secure credential storage (macOS Keychain, Windows Credential Manager) instead of local database files. |
| **`serde` / `serde_json`** | Fast JSON serialization and strict schema validation for Gemini structured output. |
| **`thiserror`** | Idiomatic typed error handling with comprehensive error variants. |
| **`tokio` (`time`)** | Asynchronous sleep utility powering the exponential retry backoff loop for HTTP 429 and 5xx responses. |
| **`tauri-plugin-log` / `log`** | Structured file-backed and stdout logging. |

---

## 3. Persistence Schema Summary

All persistence is managed locally by SQLite (`rusqlite`) in `~/Library/Application Support/dev.commodore64.text-dynamics/text_dynamics.db` (macOS).

### Tables:
1. **`schema_migrations`**:
   - `version INTEGER PRIMARY KEY`, `applied_at TEXT NOT NULL`.
2. **`documents`**:
   - `id TEXT PRIMARY KEY`, `title TEXT NOT NULL`, `content TEXT NOT NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`.
3. **`analyses`**:
   - `id TEXT PRIMARY KEY`, `document_id TEXT NOT NULL` (Foreign Key $\to$ `documents.id`), `schema_version TEXT NOT NULL`, `model_id TEXT NOT NULL`, `prompt_version TEXT NOT NULL`, `raw_analysis_json TEXT NOT NULL`, `created_at TEXT NOT NULL`.
   - Indexed on `document_id`.
   - Canonical analyses are treated as **immutable**.
4. **`analysis_overrides`**:
   - `analysis_id TEXT PRIMARY KEY` (Foreign Key $\to$ `analyses.id`), `overrides_json TEXT NOT NULL`, `updated_at TEXT NOT NULL`.
   - Houses user adjustments (dragged values, movement kind overrides, named groups).
5. **`settings`**:
   - `key TEXT PRIMARY KEY`, `value TEXT NOT NULL`, `updated_at TEXT NOT NULL`.
   - Stores non-secret settings (`model_id`, `custom_instruction`, `theme`). Secret API keys are strictly forbidden from this table.

---

## 4. Gemini Structured Integration Summary

- **Provider**: Google Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`).
- **Default Model**: `gemini-3.8-flash` (configurable in Settings).
- **Prompt Version**: `text-dynamics-1` (immutable core prompt instructions).
- **Schema Version**: `1.0` (validated against `CanonicalAnalysis` schema).
- **Deterministic Unitization**: Text is split into indexed units (`u0001`, `u0002`...) preserving exact UTF-16 code unit offsets before the request is generated.
- **Strict Invariants**:
  1. Contiguous coverage (no gaps, no overlaps).
  2. Metric range bounds ($[0, 10]$ for Intensity/Tension; $[-10, 10]$ for Valence/Temperature).
  3. Referential integrity (movements and phases only reference valid segment IDs).
- **Resilience**: Up to 3 automatic retries with exponential backoff ($1\text{s}, 2\text{s}, 4\text{s}$) on HTTP 429 (Rate Limit) or 5xx (Server Error).

---

## 5. Logging & Diagnostic Commands

```bash
# Launch application with dual stdout + session file recording:
bun run dev:logged

# Run frontend typecheck and Vite production build:
./scripts/check-frontend.sh

# Run Rust formatting check, Clippy with zero warnings allowed, and cargo check:
./scripts/check-rust.sh

# Inspect bounded development logs:
./scripts/debug-context.sh 80
./scripts/debug-context.sh 150 "req_"
```

---

## 6. Known Boundaries & Limitations

1. **Provider Token Capacity**:
   - Very long literary texts exceeding Google's input token limits for the configured model return a typed `request_too_large` error rather than crashing or truncating text silently.
2. **Subjective Analytical Output**:
   - Dynamic emotional and tension values reflect the generative interpretation of the selected Gemini model. To counter model subjectivity, Text Dynamics provides full real-time user overrides and grouping capabilities.
3. **API Key Requirement**:
   - Structural analysis requires an active Google Gemini API key. Without a key, document creation, editing, and local persistence operate fully offline, with the UI prompting for configuration on analysis request.
4. **Platform Keyring Permissions**:
   - First-time access to the system keychain on macOS may prompt a standard OS confirmation dialog to permit credential storage.
