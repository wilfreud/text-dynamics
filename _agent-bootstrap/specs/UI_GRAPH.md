# UI and graph interaction specification

## Visual direction

Monochrome, editorial, desktop-tool aesthetic.

- Black/white/neutral gray.
- Strong typography and spacing hierarchy.
- Avoid excessive cards, gradients, glowing effects, giant rounded corners, and decorative AI-dashboard clichés.
- No logo work.
- Use shadcn primitives selectively; do not wrap every region in a Card.

## Main workspace

```text
┌────────────────────────────────────────────────────────────────────┐
│ document title       metric selector       Analyze     Settings    │
├───────────────────────┬────────────────────────────────────────────┤
│                       │                                            │
│ text editor           │                 graph                      │
│                       │                                            │
│ collapsible           │          interactive nodes/movements       │
│                       │                                            │
├───────────────────────┴────────────────────────────────────────────┤
│ optional compact status / selected item context                    │
└────────────────────────────────────────────────────────────────────┘
```

The editor pane can collapse. When collapsed, the graph occupies the available workspace.

## Graph engine

Prefer custom SVG + React. Do not use React Flow by default.

Separate:

1. domain analysis;
2. effective values (AI + overrides);
3. geometry projection;
4. SVG rendering;
5. interaction state.

The renderer must not mutate domain state.

## X/Y semantics

- X axis: semantic progression/order through the source, based on segment position.
- Y axis: currently selected metric.
- Metric selector: intensity, tension, valence, temperature.
- Intensity/tension use `0..10`; valence/temperature use `-10..10` with visible neutral baseline at zero.

## Preserve discontinuities

Never apply a generic smooth spline that visually lies about the analysis.

Examples:

- `drop`: allow a near-vertical/hard edge.
- `spike`: allow steep ascent/descent.
- `plateau`: visually flat.
- `crescendo` / `decrescendo`: progressive slope.

If curves are used, movement semantics must control interpolation. Visual beauty is subordinate to structural truth.

## Node hover tooltip

Hover/focus shows a compact tooltip:

- source range label;
- short source excerpt derived locally, never Gemini-generated;
- current metric value;
- other metric values;
- AI confidence;
- movement context if applicable.

## Node click

Click selects the segment and:

- synchronizes the editor selection to the exact local source range;
- opens a lightweight inspector/popover;
- shows AI values and user override values distinctly.

## Drag edit

Vertical drag modifies only the selected metric's **user override**. It never edits the stored AI base value.

Provide reset-to-AI action.

## Multi-selection and groups

Support platform-appropriate multi-select (`Shift` and/or `Cmd/Ctrl`). Selected segments can be grouped into a named local family. Groups are user constructs and do not need another Gemini call.

## Movement inspection

Movement labels/markers are hoverable/clickable. Popover shows kind, span, magnitude, confidence, rationale. User can override movement kind.

## Metric help

Each metric selector has a tooltip describing its semantics. Keep this help locally defined and concise.

## Accessibility

- Hover information should also be reachable by keyboard/focus where practical.
- Respect reduced motion.
- Do not rely solely on color; the default design is monochrome anyway.
