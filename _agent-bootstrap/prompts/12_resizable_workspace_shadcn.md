# Task 12 — replace the fixed editor/graph split with shadcn Resizable

Execute only this task.

The application shell already exists. The current workspace uses a manually-sized/static split between:

- the **Source Text** editor on the left;
- the **Dynamic Structure Graph** workspace on the right.

Replace that manual split with the official **shadcn/ui Resizable** primitive while preserving the current monochrome desktop-tool aesthetic and all existing editor/analyze/graph behavior.

Do not redesign the application. This task is specifically about making the main workspace split robust, resizable, collapsible, keyboard-accessible, and persistent.

---

## Read first

Before editing code:

- read `AGENTS.md`;
- read `.agents/skills/tiger-style/SKILL.md`;
- read the frontend rules/guardrails already present in the project;
- inspect the existing application shell and identify the component currently responsible for the editor/graph split;
- inspect the installed shadcn version and generated component conventions;
- inspect `package.json` and the active package manager/lockfile;
- inspect whether `@/components/ui/resizable` already exists before adding anything.

Do not rewrite unrelated shell code.

---

## Official references

Use the current official implementation/documentation as the source of truth:

- shadcn Resizable:
  https://ui.shadcn.com/docs/components/base/resizable
- underlying `react-resizable-panels`:
  https://github.com/bvaughn/react-resizable-panels

Important current API details:

- shadcn exposes:
  - `ResizablePanelGroup`
  - `ResizablePanel`
  - `ResizableHandle`
- current shadcn usage uses `orientation="horizontal"`;
- current `react-resizable-panels` v4 supports percentage strings such as `defaultSize="40%"`;
- panels support min/max sizing and collapsible behavior;
- the underlying panel imperative API supports `collapse()`, `expand()`, `resize()`, and `isCollapsed()`;
- separators/handles improve keyboard accessibility.

Do not blindly use examples from old `react-resizable-panels` v2/v3 APIs such as `direction`, `PanelResizeHandle`, or numeric percentage assumptions without checking the installed version.

---

# 1. Install/use shadcn Resizable

Prefer the already configured shadcn MCP when available.

Otherwise use the project's current package manager and current shadcn CLI, equivalent to:

```bash
pnpm dlx shadcn@latest add resizable
```

Do not change package managers.

Do not hand-roll a drag separator if shadcn Resizable works in the current stack.

---

# 2. Replace the static split

The central workspace should become conceptually:

```tsx
<ResizablePanelGroup orientation="horizontal">
  <ResizablePanel id="source-editor">
    <SourceEditor />
  </ResizablePanel>

  <ResizableHandle />

  <ResizablePanel id="graph-workspace">
    <GraphWorkspace />
  </ResizablePanel>
</ResizablePanelGroup>
```

Adapt this to the actual project structure instead of creating unnecessary wrapper components.

The resizable group must occupy the full workspace between the existing top bar and bottom status bar.

Do not change the top bar or status bar layout unless required to fix sizing bugs introduced by the new group.

---

# 3. Default sizing

Use an editor-first-but-graph-dominant initial layout close to the current UI:

```text
Source editor      ~40%
Graph workspace    ~60%
```

Recommended constraints:

```text
Source editor:
  default: 40%
  min:     ~18–20%
  max:     ~65%
  collapsible: yes
  collapsed: 0%

Graph:
  default: 60%
  min:     ~35%
```

Use percentage strings with the current v4 API where appropriate.

These values are guidelines, not a reason to fight the actual component API. Keep the layout usable on smaller desktop windows.

---

# 4. Resizable handle

Use `ResizableHandle`.

The handle should:

- visually replace the current hard static vertical border;
- remain very subtle in the monochrome design;
- have a clearly larger interaction hit target than its visible line;
- show an appropriate resize cursor;
- expose a visible hover/focus state;
- remain keyboard accessible;
- not look like a large web-dashboard divider.

Prefer a thin neutral separator with a small grip/handle affordance.

Use the official `withHandle` affordance only if it fits the existing aesthetic. A custom restrained visual treatment of the generated shadcn component is acceptable.

Do not implement pointer-drag logic manually.

---

# 5. Editor collapse / expand

The editor already has a collapse control in the UI. Preserve that capability, but wire it to the resizable panel rather than maintaining a separate competing CSS width state.

Required behavior:

### Collapse

When the existing editor-collapse button is activated:

```text
Source editor -> 0%
Graph         -> fills remaining workspace
```

The graph must become effectively full-width.

### Expand

Activating the control again restores the editor.

Prefer restoring the editor to its previous non-collapsed size.

If the installed/current `react-resizable-panels` imperative API supports this cleanly, use the panel ref API rather than inventing extra width state.

Keep exactly one source of truth for whether the panel is collapsed.

### Drag-to-collapse

If the library supports collapsible threshold behavior cleanly, allow dragging the editor below its minimum threshold to collapse it.

Do not create surprising snapping behavior if the installed API/version makes this awkward.

---

# 6. Persist the workspace layout

The user's chosen split should survive application restart/reload.

Persist only UI layout state such as panel sizes/collapsed state.

Preference order:

1. use an existing lightweight application UI-preferences mechanism if the project already has one;
2. otherwise use the persistence mechanism officially supported by the current `react-resizable-panels` version, or a tiny `localStorage` entry;
3. do **not** create a new SQLite table/migration solely for panel dimensions.

Suggested storage key:

```text
text-dynamics.workspace-layout.v1
```

Persist after a completed resize, not on every pointer movement if the library provides an `onLayoutChanged`/equivalent callback.

Failure to read old/corrupt layout state must simply fall back to defaults.

Never block application startup on layout persistence.

---

# 7. Independent scrolling

The two panels must behave independently.

## Source editor

- editor content scrolls vertically inside the left panel;
- resizing the left panel must not cause body/window horizontal scroll;
- ensure flex children that need it use `min-width: 0` / `min-height: 0` equivalents;
- preserve line numbers and the existing editor behavior.

## Graph

- graph workspace owns its own available width/height;
- do not introduce body/window scrolling just because the panel changes size;
- preserve graph interactions.

Consider shadcn `ScrollArea` only where custom scrolling is actually useful. Do not wrap the entire workspace in unnecessary scroll components.

---

# 8. Make the graph truly container-responsive

The graph must react to **panel size**, not only to `window.resize`.

When the divider moves:

```text
panel width changes
      ↓
graph viewport changes
      ↓
SVG projection/rendering adapts
```

Do not:

- re-run Gemini analysis;
- mutate analysis data;
- lose selected nodes;
- reset zoom/selection state unnecessarily;
- remount the whole graph solely because the panel width changed.

If the current graph renderer assumes a fixed width, fix that boundary.

Use a container measurement strategy such as `ResizeObserver` when needed.

Keep domain data separate from geometry/layout calculations as already required by the graph architecture.

A resize is a presentation/layout event, not a domain event.

---

# 9. Animation

Dragging the resize handle itself should be immediate and directly track the pointer.

Do **not** add Anime.js easing to active panel dragging.

For explicit collapse/expand triggered by the toolbar button, a very short restrained transition is acceptable only if it does not conflict with the resizable library and respects reduced motion.

Correctness and interaction fidelity are more important than animation.

---

# 10. Preserve current behavior

The following must continue working after this task:

- source text editing;
- line numbers;
- saved/character/line status;
- Analyze button;
- Settings;
- Gemini model state;
- missing API key state;
- graph rendering;
- graph node hover/click interactions if already implemented;
- selection between graph and source text;
- logs/debugging harness.

Do not introduce a second editor state or second graph state while restructuring the shell.

---

# 11. Failure modes to explicitly avoid

Do not leave any of these behind:

### Two competing width systems

Bad:

```text
CSS width state
+
ResizablePanel state
```

Use the resizable panel as the layout authority.

### Fake collapse

Bad:

```css
opacity: 0;
width: 40%;
```

Collapse must actually release the workspace to the graph.

### Fixed graph dimensions

Bad:

```tsx
<svg width={900} height={600}>
```

when the containing panel is dynamically resizable.

### Full graph remount on every drag event

The graph should adapt geometrically without throwing away interaction state.

### Excessive persistence writes

Do not write layout state to disk/storage for every pixel of pointer movement if the API provides a completed-layout callback.

### Fragile version assumptions

Inspect the installed/current API before using props copied from old tutorials.

---

# 12. Verification

Run the application's normal frontend/Rust quality gates after implementation.

Then manually smoke-test all of these:

1. start the Tauri application;
2. default split is approximately 40/60;
3. drag divider left and right;
4. editor cannot become unusably narrow unless it collapses intentionally;
5. graph remains visible and responsive;
6. collapse editor using the existing toolbar control;
7. graph occupies the released space;
8. expand editor and confirm the previous/default width is restored;
9. resize again;
10. restart/reload app and confirm the chosen layout is restored;
11. type/paste text after resizing;
12. run an analysis;
13. resize with an existing graph visible;
14. confirm graph data and selection are not destroyed;
15. test keyboard focus/resize behavior of the separator;
16. inspect `logs/dev.latest.log` for layout/runtime errors;
17. verify there are no new React warnings or Rust errors.

If the implementation exposes a resize-related graph bug, fix the graph's container responsiveness within this task rather than masking it with fixed dimensions.

---

# 13. Completion criteria

Stop when:

- shadcn Resizable owns the editor/graph split;
- editor resizing works with mouse/pointer and keyboard;
- editor collapses and restores correctly;
- graph expands into released space;
- layout survives reload/restart;
- graph responds to container size changes;
- existing application functionality remains intact;
- quality gates pass;
- logs contain no unexplained runtime errors.

Do not proceed into unrelated redesign/refactoring.

---

# Appendix — shadcn components worth considering later

These were not part of the original kit as explicit component choices. They are **optional tools**, not a request to install all of them now.

The rule remains: install a primitive only when an actual interaction needs it.

## 1. `Resizable`

Official:
https://ui.shadcn.com/docs/components/base/resizable

Use now for:

```text
Source editor | Graph
```

This task introduces it.

---

## 2. `Scroll Area`

Official:
https://ui.shadcn.com/docs/components/base/scroll-area

Potential use:

- long source editor side content;
- long inspector content;
- document/library lists.

Do not use it merely to replace every native scrollbar.

---

## 3. `Context Menu`

Official:
https://ui.shadcn.com/docs/components/base/context-menu

Very relevant for graph nodes later.

Example:

```text
Right-click node
├─ Edit value
├─ Reset to AI
├─ Add to family
├─ Remove from family
└─ Focus source passage
```

This is a good desktop-native interaction for this application.

---

## 4. `Toggle Group`

Potential use for the graph metric selector:

```text
[ Intensity ] [ Tension ] [ Valence ] [ Temperature ]
```

Better suited than four unrelated buttons when exactly one metric/view is active.

Keep the monochrome active state subtle.

---

## 5. `Slider`

Potential use inside the selected-node inspector.

Example:

```text
Intensity
0 ─────────●──── 10
```

Useful as an alternative to graph dragging for precise manual overrides.

The graph drag remains the direct manipulation mechanism; the Slider can be the explicit inspector control.

---

## 6. `Kbd`

Official:
https://ui.shadcn.com/docs/components/base/kbd

Useful for teaching desktop shortcuts without custom badge styling.

Examples:

```text
⌘ ↵     Analyze
⌘ K     Command palette
⇧ click Multi-select
Esc     Clear selection
```

---

## 7. `Command`

Official:
https://ui.shadcn.com/docs/components/base/command

Potentially useful later for a desktop command palette:

```text
Open document
Analyze
Select metric
Toggle editor
Open settings
Reset graph overrides
```

Do not build this until there are enough actions to justify it.

---

## 8. `Combobox`

Potentially useful as an evolution of the Gemini model selector if `models.list` returns enough models that a normal Select becomes annoying.

Desired behavior:

```text
Search models...
────────────────────
Gemini 3.8 Flash     Free tier
Gemini 3.7 Flash     Free tier
Gemini 3.1 Pro       Paid only
...
```

Keep the current `Select` if the catalog remains small.

---

## 9. `Sheet`

Potential use if Settings or the selected-node inspector becomes too large for a Popover.

Good desktop pattern:

```text
Graph remains visible
                ┌──────────────┐
                │ Inspector    │
                │              │
                │ metrics      │
                │ overrides    │
                │ movements    │
                └──────────────┘
```

Do not replace small contextual Popovers with Sheets unnecessarily.

---

## 10. `Tabs`

Potential use inside a future larger inspector:

```text
[ Segment ] [ Movement ] [ Overrides ]
```

Only use Tabs if the inspector genuinely gains distinct sections. Avoid hiding five lines of information behind navigation.

---

## 11. `Sonner`

Potential use for transient confirmations:

```text
API key saved
Override reset
Document duplicated
```

Do not use toasts for persistent failures that the user must act on. Missing API key, quota errors, and analysis failures should remain visible in the existing status/error UX.

---

## 12. `Skeleton`

Potential use for a future initial-load state.

For analysis specifically, remember the current product rule:

> keep the last valid graph visible while a new analysis is running.

Therefore a Skeleton should not wipe an existing graph just because Analyze was clicked again.

---

## 13. `Spinner`

Potential use inside the Analyze button while a request is pending.

Example:

```text
[ ◌ Analyzing… ]
```

Keep it compact.

---

## 14. `Empty`

Potential replacement for bespoke empty-state markup in:

- graph before first analysis;
- empty document library;
- no model returned by Gemini API.

This can help make empty states consistent without turning them into decorative cards.

---

# Component policy

Do **not** run something like:

```bash
shadcn add --all
```

Prefer:

```text
interaction exists
      ↓
choose smallest appropriate primitive
      ↓
install that primitive only
      ↓
adapt it to Text Dynamics
```

shadcn is source code owned by this repository, not a design system that should dictate the product's visual identity.

Maintain the existing black/white editorial desktop aesthetic.
