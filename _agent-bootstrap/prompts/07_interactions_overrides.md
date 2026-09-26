# Task 07 — implement graph interactions, user overrides, grouping, and editor synchronization

Execute only this task.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `_agent-bootstrap/specs/UI_GRAPH.md`
- `_agent-bootstrap/specs/DOMAIN_AND_SCHEMA.md`

## Segment selection

Clicking/focusing a node must:

- select the semantic segment;
- derive its exact source range from local unit metadata;
- focus/scroll the editor appropriately;
- use `textarea.setSelectionRange()` or the actual editor API with the locally stored JS offsets;
- open a compact inspector/popover.

No Gemini-generated offset/excerpt may participate in source selection.

## Inspector

Show:

- locally derived excerpt;
- AI metric values;
- effective metric values;
- whether each value has a user override;
- confidence/rationale;
- reset-to-AI action.

## Drag overrides

Allow vertical drag of a node for the active metric.

- clamp to valid metric range;
- write only to the user override layer;
- preserve AI base value;
- update graph immediately;
- persist override with a reasonable debounce or on drag end;
- do not generate a new Gemini request.

## Movement overrides

Click a movement marker/span to inspect it. Allow the user to change movement kind among the known enum values and reset it to AI.

## Multi-selection and groups/families

Implement platform-appropriate multi-select. User can create a named group/family from selected contiguous or non-contiguous segments. Group metadata is local/user-authored and persists with overrides.

Keep group visualization monochrome and low-noise. Do not invent colors as the only differentiator.

## Synchronization

- Graph -> editor selection: required.
- Editor -> graph: when the caret/selection falls inside a known unit range and a valid analysis exists, highlight/select the corresponding segment where practical. Avoid expensive per-keystroke work on very long text.

## Re-analysis behavior

A new successful analysis has new segment IDs. Do not blindly apply stale overrides to a new analysis. Keep old analysis/history persisted and start the new analysis with a clean override layer unless a deterministic migration exists (none is required now).

## Verification

Manually exercise node hover/click, exact source selection with accented/emoji text, drag override, reset, movement override, multi-select/group, persistence after restart, and re-analysis behavior. Inspect logs and run quality gates.
