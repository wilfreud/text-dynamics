# Text dynamics domain and structured-output contract

## Deterministic source mapping

Do **not** ask Gemini to invent character offsets or reproduce excerpts.

The frontend first converts the source into stable atomic units. For poetry, a unit is normally one physical line. Blank lines are preserved as stanza boundaries in local metadata but do not need model scoring.

Example input to Gemini:

```json
[
  { "id": "u0001", "text": "Je regarde encore la porte." },
  { "id": "u0002", "text": "Je sais pourtant que personne ne viendra." },
  { "id": "u0003", "text": "Cela fait des heures." }
]
```

Frontend unit metadata also retains exact source offsets for editor selection. Those offsets are not model-generated.

Gemini may group contiguous units into semantic segments by returning `start_unit_id` and `end_unit_id`.

## Canonical analysis shape

Use strong Rust/TypeScript types and a JSON Schema equivalent to this conceptual structure:

```json
{
  "schema_version": "1.0",
  "segments": [
    {
      "id": "s001",
      "start_unit_id": "u0001",
      "end_unit_id": "u0002",
      "intensity": 7.2,
      "tension": 6.1,
      "valence": -3.0,
      "temperature": -1.5,
      "confidence": 0.86,
      "rationale": "brief explanation"
    }
  ],
  "movements": [
    {
      "id": "m001",
      "start_segment_id": "s001",
      "end_segment_id": "s004",
      "kind": "crescendo",
      "magnitude": 6.5,
      "confidence": 0.88,
      "rationale": "brief explanation"
    }
  ],
  "phases": [
    {
      "id": "p001",
      "start_segment_id": "s001",
      "end_segment_id": "s004",
      "kind": "build_up",
      "label": "Accumulation",
      "confidence": 0.82
    }
  ],
  "overall": {
    "summary": "brief structural reading",
    "dominant_shape": "build-up followed by a hard drop"
  }
}
```

## Allowed values

### Segment metrics

- intensity: `0 <= x <= 10`
- tension: `0 <= x <= 10`
- valence: `-10 <= x <= 10`
- temperature: `-10 <= x <= 10`
- confidence: `0 <= x <= 1`
- rationale: concise; do not generate an essay per node.

### Movement kinds

`crescendo | decrescendo | spike | drop | plateau | oscillation | rupture | reversal | reset | sustain`

### Phase kinds

`build_up | climax | break | aftermath | plateau | oscillation | other`

## Semantic validation after JSON parsing

Structured output is necessary but not sufficient. Reject or normalize invalid domain data at the boundary.

Validate:

1. `schema_version` is supported.
2. Segment IDs are unique.
3. Unit IDs referenced by segments exist.
4. Segment unit ranges are ordered and contiguous in the source order.
5. Segment sequence is ordered and does not overlap.
6. Metric ranges are valid finite numbers.
7. Movement and phase segment references exist.
8. Movement/phase ranges are forward and coherent.
9. No duplicate IDs.
10. No unknown enum values.

Do not silently invent replacement segments if validation fails. Return a typed, user-readable analysis error and keep the source text intact.

## User override model

Overrides are separate from AI analysis, conceptually:

```json
{
  "segment_overrides": {
    "s003": { "intensity": 9.0, "temperature": -4.0 }
  },
  "movement_overrides": {
    "m002": { "kind": "rupture" }
  },
  "groups": [
    {
      "id": "g001",
      "label": "Second ascent",
      "segment_ids": ["s004", "s005", "s006"]
    }
  ]
}
```

Use stable IDs. Persist overrides independently from the raw/base AI response.
