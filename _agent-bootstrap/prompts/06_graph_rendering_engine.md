# Task 06 — implement the custom SVG graph rendering engine

Execute only this task.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `_agent-bootstrap/specs/UI_GRAPH.md`
- `_agent-bootstrap/specs/DOMAIN_AND_SCHEMA.md`

## Goal

Replace the placeholder with a custom interactive-ready SVG renderer. Do not add React Flow. Avoid a charting dependency unless the existing project already has one that can represent hard discontinuities honestly.

## Separation

Create clear modules for:

1. effective analysis projection (`AI base + user overrides`);
2. domain-to-graph view model;
3. coordinate/axis geometry;
4. path generation based on movement semantics;
5. SVG rendering;
6. interaction state hooks (actual editing comes in Task 07).

Keep geometry functions independent from React where practical.

## Metrics

Implement metric selector for:

- intensity;
- tension;
- valence;
- temperature.

Axes:

- intensity/tension: 0..10;
- valence/temperature: -10..10 with neutral zero baseline.

## Rendering

Render:

- ordered segment nodes;
- connecting path/segments;
- axis/grid only as much as needed for reading values;
- movement spans/labels with minimal visual noise;
- phase bands/labels if they remain legible in monochrome;
- empty state and loading state.

## Critical semantic geometry

Do not blindly spline/smooth everything.

- `drop` must be able to appear abrupt/near vertical.
- `spike` must remain steep.
- `plateau` remains flat.
- crescendo/decrescendo can use progressive interpolation.
- rupture/reversal/reset should visually read as regime changes.

If movement metadata does not cover an edge, use a simple linear connection rather than inventing semantics.

## Tooltips

Implement hover/focus tooltip for nodes and movement markers using shadcn/Radix primitives or a lightweight equivalent. Tooltip content comes from locally mapped source units and current analysis values.

## Layout

Graph must resize when the editor collapses/expands and when window dimensions change. Avoid magic fixed canvas sizes.

## No animation yet

Keep the engine stable without Anime.js first. Task 08 adds motion.

## Verification

Use a local fixture/mock analysis in development only if necessary to exercise crescendo, spike, hard drop, plateau, negative valence, and cold/high-intensity cases. Do not ship fake analysis as fallback runtime data.

Run quality gates and visually inspect the graph at multiple window sizes.
