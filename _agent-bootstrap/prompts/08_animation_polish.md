# Task 08 — add restrained Anime.js motion and final visual polish

Execute only this task.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `.agents/skills/animejs/SKILL.md`
- `_agent-bootstrap/specs/UI_GRAPH.md`

Before writing Anime.js code, check current official React/Scope documentation.

## Motion targets

Use Anime.js only where motion improves comprehension:

- graph reveal after a successful new analysis;
- path/node transition when switching metric if it remains semantically faithful;
- editor pane collapse/expand;
- selected node emphasis;
- popover/inspector micro-transition only if the primitive does not already solve it.

Do not animate the whole application constantly.

## Lifecycle

Use `createScope()`/component-scoped cleanup where appropriate. Revert on unmount. Respect `prefers-reduced-motion`.

## Graph constraints

- final geometry is always determined by the graph engine, not Anime.js;
- never round away a hard drop/spike during animation;
- pointer drag should take precedence over animation;
- avoid re-running expensive enter animations on every minor state change.

## Visual cleanup

Audit the whole shell for:

- spacing rhythm;
- typography hierarchy;
- border weight;
- focus states;
- excessive rounding/cards;
- tooltip readability;
- inspector density;
- graph/editor balance when expanded/collapsed;
- dark/light behavior only if the scaffold already supports themes—do not create a theme system just for this task.

Stay monochrome.

## Verification

Exercise reduced-motion mode and normal mode. Confirm no animation leaks/timers after navigation/unmount. Run frontend/Rust checks and inspect logs.
