# Text Dynamics

A local-first desktop application built with **Tauri v2**, **Rust**, and **React 19** for visualizing, analyzing, and interactively editing the dynamic emotional and structural movement of literary texts and poetry.

---

## Key Features

- **Monochrome Editorial UI**: Distraction-free, typography-focused reading and writing environment.
- **Fluid Resizable Workspace**: Accessible horizontal split powered by shadcn Resizable (`react-resizable-panels`), supporting keyboard navigation, collapse/expand toggle, and persisted layout across sessions.
- **Deterministic Text Unitization**: Splits poetry and prose into ordered, immutable semantic units (`u0001`, `u0002`...) preserving exact UTF-16 code unit offsets.
- **Gemini Structured Output**: Directly queries Gemini from native Rust over HTTPS with strict JSON schema constraints and semantic validation rules.
- **Live Classified Model Catalog**: Discovers available models live via `models.list`, presenting verified Standard API billing tiers (`Free tier` vs. `Paid only`), context windows, and thinking capabilities.
- **Custom SVG Graph Engine**: Renders dynamic metric curves (Intensity, Tension, Valence, Temperature) with movement-directed geometry (`crescendo`, `decrescendo`, `drop`, `spike`, `rupture`, `plateau`, `oscillation`).
- **Interactive Overrides & Grouping**: Drag nodes to override values in real time, customize movement kinds, and cluster segments into named families without mutating the underlying canonical AI analysis.
- **Secure OS Credential Storage**: Uses the native OS Keychain (`security-framework` on macOS, Credential Manager on Windows, Secret Service on Linux) to store API keys. Keys are never saved to SQLite, logged, or exposed to frontend storage.

---

## Getting Started

### Prerequisites

- **Rust**: 1.80+ (`cargo`, `rustc`)
- **Node/Bun**: `bun` (v1.1+) or `npm` / `pnpm`
- **Native build tools**: Xcode command line tools on macOS, or standard C++ build tools on Linux/Windows

### 1. Installation

Install frontend dependencies:

```bash
bun install
```

### 2. Running Locally

To run the application with integrated dual-layer logging:

```bash
bun run dev:logged
```

*(Alternatively, run raw without logging using `bun run tauri dev`)*.

---

## Configuring the Gemini API Key

Text Dynamics requires a Google Gemini API key to run structural analyses:

1. Launch the application (`bun run dev:logged`).
2. Click the **Settings** (gear) icon in the top header navigation.
3. Paste your Gemini API key in the **Gemini API Key** field.
4. Click **Save Key**.
5. Once saved, a confirmation badge confirms `Key configured` and the **Gemini Model** dropdown automatically populates with available text-generation models, displaying their Free tier vs. Paid only status and context limits.

> **Security Note**: Your API key is stored strictly within your operating system's native keychain. It is never logged to disk, transmitted to any third party other than Google's Gemini endpoint, or stored in local SQLite databases.

---

## Verification & Diagnostics

Run the automated quality gates:

```bash
# Verify frontend TypeScript types and Vite production build
./scripts/check-frontend.sh

# Verify Rust formatting, Clippy rules, and cargo check
./scripts/check-rust.sh
```

To inspect development logs safely with bounded line counts:

```bash
# View the last 80 lines of the latest session
./scripts/debug-context.sh

# Search for a specific request ID or error pattern
./scripts/debug-context.sh 150 "req_"
```

---

## Documentation

Detailed architectural and operational documentation is available in `docs/`:

- [Architecture & Data Flow](file:///Users/wilfried/Developer/experiments/text-dynamics/docs/architecture.md) — System boundaries, IPC commands, SQLite persistence, and UI layout.
- [Local Storage & Credential Persistence](file:///Users/wilfried/Developer/experiments/text-dynamics/docs/local-storage.md) — OS Keychain credentials, SQLite application paths, durability matrix, and verification.
- [Gemini Analysis Pipeline](file:///Users/wilfried/Developer/experiments/text-dynamics/docs/gemini-analysis.md) — Structured JSON schema, live model catalog, validation rules, retry loops, and error mapping.
- [Dynamic Graph Engine](file:///Users/wilfried/Developer/experiments/text-dynamics/docs/graph.md) — Metric definitions, movement path generation, drag overrides, and Anime.js animations.
- [Debugging & Observability](file:///Users/wilfried/Developer/experiments/text-dynamics/docs/debugging.md) — Log pipelines, diagnostic scripts, secret redaction, and troubleshooting.
- [Implementation Report](file:///Users/wilfried/Developer/experiments/text-dynamics/docs/implementation-report.md) — Comprehensive technical inventory, dependencies, and audit summary.
