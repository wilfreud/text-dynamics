# Custom SVG Dynamic Graph Engine

This document details the custom SVG graph engine in Text Dynamics, covering metric semantics, movement-directed path generation, interaction behaviors, and animation rules.

---

## 1. Metric System & Semantics

The viewport displays one primary metric curve at a time across the horizontal text-progression axis:

| Metric | Range | Neutral Baseline | Analytical Meaning |
| :--- | :--- | :--- | :--- |
| **Intensity** | `[0.0, 10.0]` | None (0 is bottom) | Perceived physical or acoustic impact, weight, dynamic force, or raw energy. |
| **Tension** | `[0.0, 10.0]` | None (0 is bottom) | Psychological friction, suspense, anticipation, unresolved conflict, or structural pressure. |
| **Valence** | `[-10.0, +10.0]` | `0.0` (Dashed center line) | Affective direction: dark/negative ($-10$) vs. bright/positive ($+10$). |
| **Temperature** | `[-10.0, +10.0]` | `0.0` (Dashed center line) | Register of expression: detached/analytical/cold ($-10$) vs. passionate/visceral/hot ($+10$). |

### Invariant: Independence of Metrics
Intensity and Temperature are strictly independent. A stanza may exhibit freezing emotional detachment ($\text{temperature} = -8.0$) while exerting extreme rhetorical force ($\text{intensity} = 9.5$). Valence and Tension are likewise uncoupled.

---

## 2. Path Generation & Semantic Discontinuity (`graphPath.ts`)

The graph engine supports both **Smooth** (default) and **Linear** modes, switchable via the `Smooth / Linear` toggle in the graph header bar:

- **Monotone Cubic Spline (Fritsch-Carlson)**: In `Smooth` mode, continuous transitions are interpolated via a monotonicity-preserving cubic spline. Tangents at local peaks and valleys are strictly horizontal ($\text{slope} = 0$), preventing overshoot and artificial peaks beyond the data points.
- **Semantic Movements**: Path geometry between adjacent nodes faithfully reflects dramatic movement semantics without generic oversmoothing:
  - **`drop`**: Sustains the current level across 82% of the segment span, then plunges steeply to the subsequent node.
  - **`spike`**: Transitions abruptly in the first 25% of the span, emphasizing explosive onset.
  - **`plateau`**: Maintains a horizontal hold across 88% of the span before stepping crisply at the boundary.
  - **`crescendo` / `decrescendo`**: Smooth progressive transition with $C^1$ continuity.
  - **`rupture` / `reset`**: Crisp, orthogonal two-step transition ($L \to L \to L$), explicitly breaking spline continuity so slopes do not leak across structural shocks.
  - **`oscillation`**: Sinusoidal twin-wave inflection connecting the two states.
  - **`reversal` / `sustain` / default**: Controlled quadratic or linear interpolation (or monotone cubic in `Smooth` mode).

> **Visual Discontinuity Principle**: The graph engine explicitly preserves abrupt transitions and structural ruptures. It never applies generic smoothing filters that would obscure intentional textual shocks. Continuous spans are smoothly curved, while ruptures and drops remain sharp.

---

## 3. Visual Anatomy & Layers

The SVG canvas consists of the following stacked visual layers:

1. **Background & Grid**:
   - Subtle horizontal division lines at standard intervals.
   - Distinct dashed center baseline for bipolar metrics (`Valence` and `Temperature` at $y = 0$).
2. **Phase Bands**:
   - Translucent vertical bands spanning the duration of distinct analytical phases (`build_up`, `climax`, `break`, `aftermath`, etc.).
   - Header labels indicating phase identity and boundaries.
3. **Movement Brackets**:
   - Horizontal indicator tracks above the curves demarcating the span and kind of each active movement.
4. **Primary Semantic Path**:
   - Bold high-contrast poly-curve connecting segment node coordinates.
   - Filled gradient fill between the curve and the baseline.
5. **Segment Nodes**:
   - Circular nodes positioned at the center horizontal offset of each segment.
   - Hover targets and drag handles.
   - Distinct glyph markers indicating user-overridden values.
6. **Family / Group Overlays**:
   - Subtle color badges or boundary groupings for user-defined semantic clusters.

---

## 4. Interactive Behaviors & Overrides

### Bidirectional Text & Graph Synchrony
- Hovering or clicking a segment node in the graph highlights its corresponding lines in the text editor and scrolls the viewport if necessary.
- Moving the caret or selecting text in the editor activates and highlights the corresponding segment node in the graph.
- Offsets are calculated using exact UTF-16 code units (`startIndex`, `endIndex`) to guarantee zero drift with multi-byte or emoji characters.

### Drag Overrides (`GraphRenderer.tsx`)
- Clicking and dragging a node vertically adjusts the effective metric value in real time.
- Dragging is bounded strictly to the metric's valid range ($[0, 10]$ or $[-10, +10]$).
- Overridden values are marked with a distinct visual indicator and automatically persist to the SQLite `analysis_overrides` table.
- A "Reset" button in the Segment Inspector allows reverting individual metrics or the entire segment back to the base AI analysis.

### Movement Overrides (`MovementInspector.tsx`)
- Selecting a movement allows changing its kind (e.g., converting a `crescendo` into a `spike`).
- Changes instantly recalculate the SVG path geometry.

### Multi-Selection & Semantic Grouping (`GroupManager.tsx`)
- Holding Shift / Cmd and clicking segments enables multi-selection.
- Selected segments can be bundled into a named **Group Family** with custom color tags.
- Groups persist independently alongside analysis overrides.

---

## 5. Animation & Motion Design (`graphAnimation.ts`)

- **Engine**: Powered by **Anime.js v3**.
- **Lifecycle Safety**: All animation timelines and instances are tracked in React `useRef` handles and explicitly `.cancel()` / `.pause()` on unmount or re-render to avoid memory leaks and ghost frames.
- **Compositor Exclusivity**: Animations animate only hardware-accelerated CSS properties (`opacity`, `transform: scale()`, `stroke-dashoffset`). Anime.js **never** morphs SVG path coordinates (`d` attribute) dynamically, preserving geometric integrity and performance.
- **Accessibility (`prefers-reduced-motion`)**:
  - Automatically queries `window.matchMedia('(prefers-reduced-motion: reduce)')`.
  - When active, all durations collapse to zero and transitions resolve instantaneously.
