# Task — Rebuild Text Dynamics analysis around robust source segmentation

Execute this task completely and only this task.

The application already exists. It is a local Tauri + React desktop application that accepts pasted/written literary text, calls Gemini, and renders dynamic graphs for:

- **Intensity**
- **Tension**
- **Valence**
- **Temperature**

The current analysis pipeline appears to derive graph points too directly from source lines/paragraphs. This causes a major failure mode:

> a long piece of prose pasted as one paragraph can collapse into one or two graph points, even though the text contains many internal emotional/dynamic transitions.

The purpose of this task is to rebuild the analysis boundary so the application works consistently for all of these inputs:

```text
A single-line prose paste
A giant paragraph
Well-structured prose with many paragraphs
Poetry with one phrase per line
Poetry with stanzas
Poetry with very little punctuation
Mixed prose/poetry
Text with blank lines used structurally
```

The central rule is:

> **Author formatting is source structure. It is not automatically analysis structure.**

The application must preserve the author's paragraph/line structure, derive deterministic local atomic units, then let Gemini group contiguous atomic units into semantic/dynamic segments.

The graph must render the **semantic segments**, not the raw paragraphs and not every source line.

---

# 0. Read first — audit before editing

Before changing code, inspect the actual repository.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- Gemini/structured-output skill if present
- Rust/Tauri guardrail skill if present
- observability/debugging skill if present
- graph-related architecture/spec documents already in the project
- current Gemini system prompt
- current Gemini JSON schema
- current analysis request/response TypeScript types
- Rust Gemini client
- source editor implementation
- graph renderer
- SQLite schema/migrations
- analysis persistence code
- graph ↔ text selection code
- tests around parsing, analysis, graph rendering, and selection
- current logs

Search for concepts such as:

```text
segment
segments
paragraph
paragraphs
line
lines
offset
startOffset
endOffset
unit
units
analysis
intensity
tension
valence
temperature
movement
phase
generateContent
responseSchema
responseJsonSchema
structured output
```

Do not assume the current implementation matches older project specifications.

Write a short implementation note in the task output describing:

1. how source segmentation currently works;
2. why the current behavior produces too few points for long one-paragraph text;
3. which files will be changed;
4. whether a DB migration is actually required.

Then implement.

---

# 1. Product invariant

The same semantic text should produce broadly comparable analysis granularity whether the user pasted it as:

```text
one huge line
```

or:

```text
carefully formatted paragraphs
```

Formatting must still matter, especially for poetry, but formatting must be treated as **evidence**, not as a forced one-to-one graph mapping.

Bad:

```text
paragraph = graph point
```

Bad:

```text
line = graph point
```

Bad:

```text
sentence = graph point
```

Correct conceptual pipeline:

```text
                     ORIGINAL TEXT
                           │
                           │ exact source preserved
                           ▼
                 SOURCE STRUCTURE PARSER
                           │
                ┌──────────┴──────────┐
                │                     │
            paragraphs             lines
            / stanzas              preserved
                │                     │
                └──────────┬──────────┘
                           ▼
                    ATOMIC UNITS
                   u0001 ... u00NN
                           │
                           │ deterministic local preprocessing
                           ▼
                        GEMINI
                           │
                 semantic grouping
                           │
                           ▼
                  SEMANTIC SEGMENTS
                    s001 ... s00N
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
           metrics      movements      phases
             │
             ▼
                         GRAPH
```

The graph points correspond to `SemanticSegment`, not `AtomicUnit`.

---

# 2. Preserve the original text exactly

The editor's canonical content must remain the exact user text.

Do not normalize and overwrite it.

Do not mutate:

- whitespace;
- paragraph breaks;
- punctuation;
- quotes;
- apostrophes;
- Unicode;
- accented characters;
- ellipses;
- em/en dashes.

If line ending normalization is necessary internally, it must not corrupt editor offsets.

Prefer deriving structural metadata directly from the exact JavaScript string used by the editor.

The source text is the authority.

---

# 3. Offset convention — make this explicit

The graph must be able to select the exact corresponding source passage.

Because the editor is in JavaScript/React, define analysis source offsets in terms compatible with JavaScript string/editor selection semantics.

Use one explicit convention across the frontend analysis layer, for example:

```text
UTF-16 code-unit offsets
start inclusive
end exclusive
```

This matches ordinary JavaScript string indices and textarea `selectionStart`/`selectionEnd` behavior.

Important:

- Rust uses UTF-8 strings/byte concepts differently.
- Gemini must never calculate offsets.
- Do not ask the model for character indices.
- Do not convert model guesses into editor offsets.

The frontend/local segmentation layer owns source offsets.

Gemini receives IDs and text.

Gemini returns IDs.

The application resolves IDs back to local offsets.

This prevents Unicode bugs with:

```text
é
œ
’
—
…
emoji
combined characters
```

If the current editor uses a different explicit offset convention, preserve it only if it is already correct and tested.

Document the convention in code.

---

# 4. Structural model

Create or adapt a small deterministic source-analysis model.

Conceptually:

```ts
type SourceParagraph = {
  id: string
  index: number
  startOffset: number
  endOffset: number
  lineIds: string[]
}

type SourceLine = {
  id: string
  paragraphId: string
  index: number
  startOffset: number
  endOffset: number
  text: string
  isBlank: boolean
}

type AtomicUnit = {
  id: string
  index: number

  paragraphId: string
  lineId: string

  startOffset: number
  endOffset: number

  text: string

  kind:
    | "sentence"
    | "poetic-line"
    | "clause-fallback"
    | "length-fallback"
}
```

Adapt names to the repository conventions.

Do not create heavyweight domain abstractions for this.

The important invariants are:

```text
Atomic units are ordered.
Atomic units never overlap.
Atomic units map exactly to source ranges.
Every non-whitespace meaningful piece of source text belongs to a unit.
Paragraph/line identity remains available.
```

Blank lines remain structural metadata but do not need to become semantic units.

---

# 5. Paragraph / stanza detection

Treat one or more blank lines as a strong structural boundary.

Conceptually:

```text
text

text
```

creates two paragraph/stanza groups.

Examples:

```text
Moins de bruit.

Il est encore une heure...
```

becomes:

```text
P001
  source: "Moins de bruit."

P002
  source: "Il est encore une heure..."
```

Poetry:

```text
je marche
encore
encore

puis plus rien
```

becomes:

```text
P001
  line 1
  line 2
  line 3

P002
  line 4
```

Do not collapse blank-line structure before analysis.

Multiple consecutive blank lines can represent one paragraph boundary plus source spacing metadata; do not create many empty semantic units.

---

# 6. Preserve physical line information

Within a paragraph/stanza, preserve physical line boundaries.

Line breaks can be semantically important in poetry.

However:

> line boundaries are candidate/structural boundaries, not forced graph-point boundaries.

This text:

```text
je marche
encore
encore
encore

puis plus rien
```

must remain structurally distinct from:

```text
je marche encore encore encore puis plus rien
```

even though Gemini may group several lines into the same semantic segment.

---

# 7. Atomic unit generation

Atomic units are the deterministic local vocabulary Gemini is allowed to group.

The goal is robust behavior across both prose and poetry.

Use this strategy unless the actual repository architecture requires a clearly equivalent implementation.

---

## 7.1 Non-empty line as first structural scope

Process each non-empty physical line independently.

Why:

- poetry often uses line breaks without punctuation;
- a line break should not disappear merely because a sentence tokenizer wants to merge across it;
- arbitrary prose line breaks may create extra atomic units, but Gemini can merge contiguous units later.

This gives a conservative source representation.

---

## 7.2 Sentence segmentation inside each line

Within each non-empty line, use a standards-based sentence segmenter when available.

Preferred browser/runtime primitive:

```ts
new Intl.Segmenter(locale, {
  granularity: "sentence",
})
```

Do not add a large NLP library unless the current environment genuinely needs one.

Choose locale sensibly:

- if the project already tracks document language, use it;
- otherwise `fr` is reasonable for the current French-first use case;
- if language is unknown/mixed, test whether the runtime default behaves sufficiently;
- avoid language detection overengineering for this task.

Preserve offsets from the original line/string.

Do not reconstruct source text by joining segmented strings.

---

## 7.3 Poetry/no-punctuation behavior

A short line with no terminal punctuation remains one atomic unit.

Example:

```text
je marche
encore
encore
```

becomes:

```text
u0001 "je marche"
u0002 "encore"
u0003 "encore"
```

Gemini may later group them into one segment.

This is intentional.

---

## 7.4 Multiple sentences on one line

Example:

```text
Il est tard. Je devrais partir. Pourtant je reste.
```

should produce approximately:

```text
u0001 "Il est tard."
u0002 "Je devrais partir."
u0003 "Pourtant je reste."
```

These are atomic units, not automatically graph points.

---

## 7.5 Very long unpunctuated line fallback

Do not allow one pathological source line with no recognized sentence boundaries to become an enormous atomic unit.

Create a conservative emergency fallback.

Example policy:

```text
if one candidate atomic unit exceeds ~500–800 characters
    prefer split near:
      semicolon
      colon
      em dash
      comma
      strong conjunction boundary only if needed
    otherwise split near whitespace
```

Choose one documented threshold suitable for the current implementation.

This is an **atomic-unit safety threshold**, not an application input-length limit.

Do not tell the user their text is too long merely because one line is long.

Every fallback split must preserve exact offsets.

Mark fallback unit kind appropriately, e.g.:

```text
clause-fallback
length-fallback
```

Do not attempt sophisticated syntactic parsing.

---

# 8. Do not impose a document character limit

The application should not add an arbitrary UI character limit.

The real external constraint is the selected Gemini model's context window / API limits.

Keep source preprocessing capable of operating on arbitrarily large local strings within reasonable desktop memory constraints.

If the Gemini layer already checks/counts tokens, preserve that logic.

If it does not, do not derail this task into a full long-document chunking system unless the actual analysis call fails because of context size.

When provider limits are exceeded:

```text
show a clear provider/context error
```

not:

```text
truncate silently
```

Never silently drop the end of a poem/text.

---

# 9. Stable unit IDs

Assign deterministic IDs in source order for each analysis request:

```text
u0001
u0002
u0003
...
```

Paragraphs:

```text
p001
p002
...
```

Lines may use:

```text
l0001
l0002
...
```

These IDs are analysis-local identifiers.

They do not need to survive arbitrary document edits.

If the text changes, the previous analysis must already be considered tied to the old source snapshot/hash.

Do not use random UUIDs for every atomic unit unless the project has a compelling existing reason.

Ordered human-readable IDs make debugging model output much easier.

---

# 10. Source hash / analysis identity

Tie every analysis to the exact source version.

Prefer a deterministic source hash or existing document revision mechanism.

Conceptually:

```ts
analysis.sourceHash
analysis.sourceLength
analysis.segmenterVersion
```

The graph must not pretend an old analysis corresponds to newly edited text.

If the existing app already invalidates analysis after source edits, preserve that behavior.

Do not overengineer content-addressed storage.

---

# 11. What is sent to Gemini

Gemini should receive:

1. analysis instructions;
2. compact structural units;
3. paragraph/stanza information;
4. the structured output schema.

Gemini does **not** need:

- character offsets;
- editor coordinates;
- DOM information;
- SQLite IDs;
- raw database data.

A compact payload can conceptually resemble:

```text
[P001]
[u0001] Moins de bruit.
[/P001]

[P002]
[u0002] Il est encore une heure.
[u0003] Ce n’est pas la première fois que je me dis que ce sera la dernière.
[u0004] Une dernière valse dans le noir, une dernière mauvaise passe tard le soir.
...
[/P002]
```

or equivalent compact JSON.

Use whichever representation integrates cleanly with the existing Gemini client.

Avoid sending duplicated source text if not needed.

---

# 12. Core Gemini interpretation rule

Gemini's responsibility is **not sentence segmentation**.

Gemini's responsibility is:

> group contiguous atomic units into semantically coherent dynamic segments and assign meaningful metrics to those segments.

Gemini may:

```text
group multiple sentences into one segment
split one paragraph into multiple segments
group adjacent short paragraphs when the movement clearly continues
treat one poetic line as a segment when it constitutes a genuine rupture
```

Gemini may not:

```text
reorder units
skip units
duplicate units across segments
invent unit IDs
select non-contiguous units for one segment
```

---

# 13. Paragraphs are strong hints, not hard constraints

Tell Gemini explicitly:

> Paragraph/stanza boundaries are strong authorial structural evidence. Prefer respecting them, but do not mechanically equate them with semantic segments.

A segment may cross a paragraph boundary only when the dynamic state genuinely continues.

Examples where crossing may be reasonable:

```text
P1: "Je ne sais pas."
P2: "Je ne sais toujours pas."
```

Examples where it probably should not:

```text
P1: sustained rumination
P2: abrupt comic aside
```

Do not hardcode these examples as scoring rules.

They illustrate the principle.

---

# 14. Semantic segment definition

A `SemanticSegment` represents a local dynamic regime.

Create a new segment when there is a meaningful shift in one or more dimensions such as:

- intensity;
- tension;
- valence;
- temperature;
- rhetorical register;
- subject/focus;
- pacing;
- emotional stance;
- perspective;
- irony;
- detachment;
- escalation;
- release;
- rupture;
- aftermath.

Do not create a new segment merely because:

```text
a sentence ended
a line ended
a paragraph ended
```

Those are evidence, not commands.

---

# 15. Avoid under-segmentation

The current system's main problem is under-segmentation.

Explicitly instruct Gemini:

> Do not collapse a long text into one or two broad segments when it contains multiple distinct internal movements.

For a text containing:

```text
setup
rumination
accumulation
climax
ironic break
aftermath
```

it should usually produce several segments.

Do not force a fixed number.

The correct count is driven by meaningful dynamic changes.

---

# 16. Avoid over-segmentation

The opposite failure is also bad.

Do not produce one semantic segment per sentence simply because atomic units exist.

A segment may contain many units if the dynamic state is stable.

Singleton segments should usually correspond to something genuinely salient:

```text
abrupt rupture
isolated title
one-line reversal
climax
silence/reset
```

not ordinary prose continuity.

---

# 17. Metric definitions

Keep the four metric definitions sharply separated.

This is important because **Intensity** and **Tension** must not collapse into the same curve.

---

## 17.1 Intensity — 0 to 10

Definition:

> Perceived force, impact, acoustic weight, visceral energy, rhetorical force, or experiential magnitude of the passage.

Examples of high intensity:

- explosive language;
- emphatic accumulation;
- visceral imagery;
- shouting/violent rhetorical force;
- overwhelming sensation;
- major climax.

Examples of low intensity:

- quiet observation;
- minimal statement;
- neutral setup;
- sparse subdued language.

Important:

```text
high intensity ≠ high tension
```

A cathartic explosion may be very intense while releasing tension.

---

## 17.2 Tension — 0 to 10

Definition:

> Psychological suspense, pressure, unresolved expectancy, conflict, constriction, or accumulating unease.

Examples of high tension:

- unresolved threat;
- waiting;
- claustrophobia;
- anticipation;
- mental pressure;
- contradiction without release.

Examples of lower tension:

- resolved aftermath;
- acceptance;
- comic release;
- calm description.

Important:

```text
high tension can be quiet
```

A restrained passage may have low acoustic intensity and very high tension.

---

## 17.3 Valence — -10 to +10

Definition:

> Affective direction from dark/negative to bright/positive.

Conceptually:

```text
-10  profoundly dark / painful / negative
  0  neutral / mixed / ambiguous
+10  strongly bright / joyful / positive
```

Valence is not intensity.

A passage can be:

```text
very negative but calm
very positive but low-energy
```

---

## 17.4 Temperature — -10 to +10

Definition:

> Affective register from detached/cold to passionate/warm/hot.

Conceptually:

```text
-10  icy, detached, clinical, emotionally withdrawn
  0  neutral/mixed
+10  warm, passionate, heated, emotionally embodied
```

Temperature is not valence.

Examples:

```text
cold + negative
    detached despair

hot + negative
    rage / anguish

cold + positive
    serene distance

hot + positive
    affection / elation
```

This distinction must appear in the Gemini prompt.

---

# 18. Segment-local explanation

Each semantic segment should include a short explanation/rationale suitable for inspection.

Do not ask for an essay.

Conceptually:

```json
{
  "summary": "Rumination intensifies through repeated self-observation and existential framing.",
  "rationale": "Repetition and accumulating self-comparison increase pressure without yet reaching the later climax."
}
```

Keep these concise.

They are useful for:

- graph node popover;
- debugging;
- judging whether Gemini understood the segment;
- later manual correction.

Do not use them as the source of truth for graph geometry.

---

# 19. Segment output schema

Adapt to the existing structured-output architecture.

Conceptually require:

```ts
type GeminiSemanticSegment = {
  id: string

  firstUnitId: string
  lastUnitId: string

  label: string
  summary: string

  metrics: {
    intensity: number       // 0..10
    tension: number         // 0..10
    valence: number         // -10..10
    temperature: number     // -10..10
  }

  confidence?: number       // 0..1 if already used
}
```

Prefer first/last IDs over asking the model to repeat every unit ID when segments are guaranteed contiguous.

If the current schema already uses `unitIds`, retaining that is acceptable.

The application must validate contiguity locally either way.

Do not ask Gemini for source offsets.

---

# 20. Local resolved segment

After valid model output, resolve model IDs to deterministic local source data:

```ts
type ResolvedSemanticSegment = {
  id: string

  firstUnitId: string
  lastUnitId: string

  startOffset: number
  endOffset: number

  paragraphIds: string[]

  label: string
  summary: string

  metrics: {
    intensity: number
    tension: number
    valence: number
    temperature: number
  }

  aiMetrics: ...
  userMetrics?: ...
}
```

Use the first unit's `startOffset` and last unit's `endOffset`.

Never compute these offsets from model-generated text excerpts.

---

# 21. Complete coverage invariant

Model segments must cover all meaningful atomic units exactly once.

Valid:

```text
units:
u001 u002 u003 u004 u005 u006

segments:
s1 = u001-u002
s2 = u003-u005
s3 = u006
```

Invalid gap:

```text
s1 = u001-u002
s2 = u004-u006

missing u003
```

Invalid overlap:

```text
s1 = u001-u004
s2 = u004-u006
```

Invalid reorder:

```text
s1 = u004-u006
s2 = u001-u003
```

Reject these locally.

---

# 22. Model-output validator

Implement an explicit validator after JSON schema parsing.

Structured output guarantees shape better than free text, but it does **not** guarantee semantic/index consistency.

Validate:

- every referenced unit ID exists;
- `firstUnitId <= lastUnitId` in source order;
- segments are ordered;
- segments are contiguous;
- no gaps;
- no overlaps;
- complete unit coverage;
- metric values are finite;
- metrics are within range;
- IDs are unique;
- labels/summaries respect reasonable length constraints;
- movement references exist;
- phase references exist if phases are returned.

Do not pass structurally invalid analysis to the graph.

---

# 23. Repair policy

If Gemini returns syntactically valid JSON but structurally invalid segmentation:

1. log the validation reason safely;
2. perform at most **one repair retry** using the same units;
3. tell Gemini exactly what constraint failed;
4. keep structured output enabled;
5. validate again;
6. if still invalid, return an explicit analysis error.

Do not enter an unbounded retry loop.

Do not silently "fix" overlapping model segments by guessing what Gemini meant.

Simple local normalization is allowed only for harmless formatting, not semantic ownership.

---

# 24. Granularity sanity checks

Add diagnostics for obviously suspicious granularity.

Do not enforce a rigid segment count formula.

Useful warning cases:

```text
many atomic units + only one semantic segment
every atomic unit became a semantic segment
very long segment despite strong paragraph/register changes
```

Example:

```text
if atomicUnitCount >= 8 && segmentCount == 1:
    flag "possible-under-segmentation"
```

Example:

```text
if atomicUnitCount >= 10 && segmentCount == atomicUnitCount:
    flag "possible-over-segmentation"
```

Treat these as diagnostics.

Do not automatically reject valid literary interpretations solely because of a heuristic.

A single repair retry for extreme one-segment output may be acceptable if the prompt explicitly asks Gemini to reconsider granularity.

Document whichever policy you implement.

---

# 25. Canonical Gemini analysis instruction

Adapt the existing prompt rather than creating duplicate competing prompts.

The core instruction should communicate the following semantics.

Use this as the intended content, adjusting formatting to the project's prompt architecture:

```text
You are analyzing the dynamic structure of a literary text.

The input has already been split into ordered atomic source units.
Each unit has a stable ID such as u0001.
Paragraph/stanza boundaries are explicitly marked.

Your job is NOT to perform sentence segmentation.

Your job is to group contiguous atomic units into semantic dynamic segments.

A semantic segment is a contiguous region of the text that maintains a broadly coherent emotional/rhetorical dynamic state.

Create a segment boundary when there is a meaningful change in one or more of:

- intensity
- tension
- valence
- temperature
- rhetorical register
- pacing
- emotional stance
- focus
- irony
- escalation
- release
- rupture
- aftermath

Paragraph/stanza boundaries are strong structural evidence but are not mandatory segment boundaries.

Do not mechanically create one segment per paragraph, sentence, or line.

Do not collapse a long text into one or two segments if it contains several distinct internal movements.

Do not over-segment stable passages.

Segments must:

- use only supplied unit IDs;
- preserve source order;
- be contiguous;
- never overlap;
- collectively cover every supplied unit exactly once.

For every segment, score:

INTENSITY: 0..10
Perceived force, impact, acoustic weight, visceral energy, rhetorical force, or experiential magnitude.

TENSION: 0..10
Psychological suspense, pressure, unresolved expectancy, conflict, constriction, or accumulating unease.

VALENCE: -10..+10
Affective direction from dark/negative to bright/positive.

TEMPERATURE: -10..+10
Affective register from detached/cold to passionate/warm/hot.

Do not conflate these dimensions.

A passage can have:
- high tension but low intensity;
- high intensity but low tension;
- negative valence but warm temperature;
- positive valence but cold temperature.

Give each segment a concise label and concise interpretive summary.

Pay particular attention to abrupt changes such as:
- escalation;
- drop;
- ironic break;
- register shift;
- climax;
- release;
- emotional cooling;
- renewed pressure;
- resignation;
- aftermath.

Return only the structured response required by the supplied schema.
```

Do not tell Gemini to wrap JSON in Markdown fences.

Use native Gemini structured output / response schema already used by the project.

---

# 26. Movements

If the application already supports movements, keep them but make them reference semantic segments.

A movement is the relationship/change between adjacent semantic segments.

Conceptual types may include:

```text
crescendo
decrescendo
spike
drop
plateau
oscillation
rupture
reversal
reset
sustain
transition
```

Do not force every adjacent pair into a dramatic label.

A normal gradual shift can be `transition`.

Movements should be based on:

```text
metric changes
+
semantic/register change
```

not just raw intensity delta.

Example:

```text
segment 5 -> segment 6
intensity: 8.7 -> 5.2
tension:   9.0 -> 4.8
valence:  -7.0 -> -2.0
temp:      0.0 -> +3.5

semantic change:
rumination/climax -> ironic aside

movement:
rupture / comic release
```

The exact project schema may support one primary movement type plus an explanation.

Do not add a huge ontology unless already present.

---

# 27. Phases

If the application already supports higher-level phases, preserve them.

Phases group adjacent semantic segments into larger arcs such as:

```text
setup
build-up
climax
break
aftermath
resolution
```

Phases are optional higher-level interpretation.

They must not replace semantic segments.

Conceptual hierarchy:

```text
source
  ↓
atomic units
  ↓
semantic segments
  ↓
movements
  ↓
phases
```

Do not generate graph points directly from phases.

---

# 28. Graph X-axis semantics

The graph X-axis must represent **semantic segment order**.

If Gemini returns eight segments:

```text
1 2 3 4 5 6 7 8
```

not:

```text
paragraph count
```

and not:

```text
sentence count
```

Each point represents one semantic segment.

Keep the current metric switching:

```text
Intensity
Tension
Valence
Temperature
```

The same segment set must underlie all four curves.

Switching metric should change Y values, not re-segment the text.

---

# 29. Graph ↔ text interaction

Clicking or focusing a graph point must select/highlight the exact corresponding source range.

Resolve:

```text
segment
  ↓
first atomic unit startOffset
last atomic unit endOffset
  ↓
editor selection/highlight
```

Do not search the source text by matching segment excerpts.

Duplicate phrases make text search ambiguous.

Offsets are deterministic.

---

# 30. Point tooltip / popover content

For a graph node, expose useful interpretation.

Recommended content:

```text
Segment 4
"Accumulating confinement"

Intensity     8.2
Tension       8.8
Valence      -6.4
Temperature  -1.2

Units
u0009–u0012

Source excerpt
"Il est tard ... bruit assourdissant ..."

Interpretation
"Repetition and spatial confinement culminate in an explicit image of internal noise."
```

Keep source excerpt short.

Do not dump a huge paragraph into a tooltip.

Use a popover/inspector for longer content if already supported.

---

# 31. Manual metric overrides

Preserve the existing principle:

```text
AI metric value
+
optional user override
```

Do not overwrite the original AI metric when the user drags/edits a point.

Semantic segmentation and metric editing are separate concerns.

If the user edits source text, invalidate/reanalyze as appropriate.

If the user only edits a metric, do not re-run segmentation.

---

# 32. Do not let formatting alone create fake dynamics

Important example.

Input A:

```text
Je suis fatigué. Je ferme les yeux. Rien ne change.
```

Input B:

```text
Je suis fatigué.

Je ferme les yeux.

Rien ne change.
```

Paragraph boundaries differ.

Gemini may choose slightly different boundaries because formatting is evidence.

But the application must not force:

```text
A = one point
B = three points
```

merely because of blank lines.

The semantic grouping layer exists specifically to avoid this.

---

# 33. One-line prose acceptance test

Use a fixture resembling:

```text
Il est encore une heure. Ce n’est pas la première fois que je me dis que ce sera la dernière. Une dernière valse dans le noir. Je fuis le sommeil. Je préfère contempler le vide. Je devrais peut-être fuir. C’est une solution comme une autre. Je serai seul mais ce sera enfin justifié.
```

Expected preprocessing characteristics:

```text
paragraphs: 1
atomic units: several
semantic segments: determined by Gemini, normally >1
```

The graph must not be limited to one point simply because `paragraphs == 1`.

---

# 34. Large-paragraph acceptance test

Use the application's existing longer French prose fixture if present.

If none exists, create a test fixture with:

```text
setup
existential rumination
environmental fixation
accumulation
climax
ironic/comic break
resigned aftermath
```

all in one paragraph.

Expected:

```text
1 paragraph
many atomic units
multiple semantic segments
```

Do not assert exact Gemini scores in unit tests.

Test deterministic preprocessing separately from live-model interpretation.

---

# 35. Well-paragraphed acceptance test

Input:

```text
Paragraph 1 with several sentences.

Paragraph 2 with several sentences.

Paragraph 3 with a brief shift.
```

Expected:

```text
paragraph metadata preserved
sentences become atomic units
Gemini may create:
  one or more segments inside each paragraph
  or cross a paragraph boundary when continuity warrants it
```

Do not assert:

```text
segments == paragraphs
```

---

# 36. Poetry acceptance test

Use:

```text
je marche
encore
encore
encore

puis plus rien
```

Expected preprocessing:

```text
paragraph/stanza count: 2

units:
u0001 je marche
u0002 encore
u0003 encore
u0004 encore
u0005 puis plus rien
```

Gemini may group:

```text
s1 u0001-u0004
s2 u0005-u0005
```

or another defensible interpretation.

The important requirement is that the parser does not lose line breaks merely because punctuation is absent.

---

# 37. Mixed punctuation acceptance test

Cover:

```text
« Tu viens ? » Non. Peut-être… Je ne sais pas — pas encore.
```

Ensure:

- units preserve correct source ranges;
- smart quotes work;
- ellipsis works;
- em dash does not corrupt offsets;
- graph selection selects the correct source.

---

# 38. Unicode offset test

Include text containing characters such as:

```text
é
œ
’
…
—
🙂
```

Verify:

```text
source.slice(startOffset, endOffset)
```

returns exactly the unit/segment text under the selected offset convention.

This test is important.

Do not assume Rust byte offsets equal JS editor offsets.

---

# 39. CRLF test

Test source containing Windows-style:

```text
\r\n
```

If the editor/runtime normalizes line endings automatically, document the actual behavior.

Whatever happens, offsets used for editor selection must correspond to the string the editor actually owns.

Do not calculate offsets from a differently normalized copy.

---

# 40. Leading/trailing whitespace test

Input may contain:

```text


  text


```

Do not create meaningless semantic units from blank/whitespace-only content.

Preserve canonical source.

Atomic unit offsets should select meaningful text.

Paragraph metadata may record surrounding structure as needed.

---

# 41. Long unpunctuated unit test

Create a deterministic parser test with a very long line containing no terminal punctuation.

Verify:

- it does not become one enormous unit beyond the chosen safety threshold;
- fallback splitting occurs at safe source boundaries;
- every fallback unit maps correctly to source offsets;
- joining source ranges conceptually covers the original meaningful line without reordering.

---

# 42. Deterministic parser tests must not call Gemini

Split test responsibilities.

## Local unit tests

Test:

- paragraphs;
- lines;
- sentence segmentation integration wrapper;
- fallback segmentation;
- IDs;
- offsets;
- source coverage;
- Unicode;
- CRLF;
- blank lines.

These tests must be deterministic and offline.

## Gemini integration test

If the project has integration testing infrastructure, use a small optional live test gated by API key/environment.

Do not make the normal test suite depend on Gemini availability or quota.

---

# 43. Gemini response tests

Use fixtures/mocks for model responses.

Test validator behavior:

- valid contiguous segmentation;
- missing unit;
- unknown unit;
- overlap;
- reorder;
- out-of-range metric;
- NaN/non-number equivalent if parser allows;
- duplicate segment IDs;
- segment gap;
- invalid movement reference.

The graph must never receive invalid model output.

---

# 44. Persistence

Inspect the current SQLite model before changing it.

Prefer storing resolved semantic segments tied to an analysis/source snapshot.

Useful persisted fields may include:

```text
analysis_id
segment_id
ordinal
start_offset
end_offset
first_unit_id
last_unit_id
label
summary
ai_intensity
ai_tension
ai_valence
ai_temperature
user overrides...
```

Do not automatically create a normalized `atomic_units` table unless the current architecture genuinely benefits from it.

For this small local app, storing:

```text
analysis source snapshot/hash
+
resolved segment offsets
+
segment metadata
```

is likely sufficient.

If the existing schema already supports this cleanly, do not migrate unnecessarily.

---

# 45. Analysis after source edits

An analysis belongs to a specific source state.

If the source changes:

```text
old graph should not silently claim to represent new text
```

Use the existing dirty/stale state if available.

Conceptual behavior:

```text
source text edited
      ↓
analysis marked stale
      ↓
user clicks Analyze
      ↓
new atomic units
      ↓
new Gemini segmentation
      ↓
new graph
```

Do not attempt to incrementally preserve old semantic segment IDs across arbitrary text edits in this task.

---

# 46. Logging

Add structured, safe diagnostic logs.

Good:

```text
[analysis] source_chars=1842
[analysis] paragraphs=2
[analysis] lines=3
[analysis] atomic_units=18
[analysis] segmentation_fallbacks=0
[analysis] model=gemini-...
[analysis] semantic_segments=7
[analysis] movements=6
[analysis] phases=3
[analysis] duration_ms=...
[analysis] granularity_warning=none
```

Bad:

```text
[analysis] full_source_text="..."
```

Do not log the user's full poem/text by default.

Do not log API keys.

Do not log full Gemini payloads if they contain the source unless explicitly running a safe opt-in diagnostic mode.

---

# 47. Debug information

For local development, it is useful to expose a compact analysis-debug summary in logs.

Example:

```text
source
  paragraphs: 2
  lines: 4
  atomicUnits: 17

gemini
  segments: 8
  retries: 0

segment ranges:
  s001 u0001-u0001
  s002 u0002-u0004
  s003 u0005-u0007
  s004 u0008-u0010
  ...
```

Do not include source text unless needed for a temporary local debug action, and remove such logging before completion.

---

# 48. Example target behavior for the motivating text

For a text structurally similar to:

```text
Moins de bruit.

Il est encore une heure. Ce n’est pas la première fois...
...
Je me sentirai seul mais ce sera enfin justifié.
```

the parser might produce approximately:

```text
P001
  u0001 Moins de bruit.

P002
  u0002 Il est encore une heure.
  u0003 Ce n’est pas la première fois...
  u0004 Une dernière valse...
  u0005 Je fuis le sommeil...
  ...
  u0017 Je me sentirai seul...
```

Gemini might then choose conceptually:

```text
s001 u0001-u0001     title / quiet imperative
s002 u0002-u0004     nocturnal setup
s003 u0005-u0007     existential rumination
s004 u0008-u0011     room / objects / confinement
s005 u0012-u0013     noise / pressure climax
s006 u0014-u0015     escape fantasy / ironic break
s007 u0016-u0017     resignation / aftermath
```

This is only an illustration.

Do **not** hardcode these boundaries or scores.

The implementation goal is to give Gemini enough deterministic structure to make this kind of interpretation possible.

---

# 49. Metric divergence check

Because the four metrics have distinct meanings, monitor whether they become suspiciously identical.

Do not reject an analysis merely because two curves are correlated.

But log or inspect cases where:

```text
Intensity == Tension
```

for every segment across a long text.

The prompt definitions should make divergence possible.

Examples the model must conceptually understand:

```text
quiet dread
  intensity low
  tension high

violent catharsis
  intensity high
  tension falling

cold despair
  valence negative
  temperature negative

angry grief
  valence negative
  temperature positive/hot
```

Do not mechanically modify scores to force divergence.

The model must interpret them independently.

---

# 50. Graph rendering behavior after this change

Do not redesign the visual graph.

Preserve the current black/white aesthetic.

Only adapt what is necessary so the graph consumes semantic segments.

Requirements:

- X-axis length reflects segment count;
- all metric tabs use the same segment ordering;
- graph remains responsive to its container;
- node hover/click still works;
- source selection still works;
- manual point overrides still work;
- switching metric does not call Gemini again;
- resizing workspace does not call Gemini again.

---

# 51. Loading behavior

When analysis begins:

- keep source text intact;
- show analysis pending state;
- do not clear the current valid graph unnecessarily if product behavior already preserves it;
- on success, atomically replace the analysis;
- on failure, keep the last valid analysis if that is the current project policy.

Do not show a half-validated Gemini response.

---

# 52. Error messages

Useful failures:

```text
Analysis failed: Gemini returned an invalid segment range.
Analysis failed: one or more source units were omitted.
Analysis failed: selected model context limit was exceeded.
```

Do not expose huge raw model responses to the user.

Put technical details in safe logs.

---

# 53. Performance

The local segmentation pass should be cheap.

Target conceptual complexity:

```text
O(n)
```

over source text length, aside from sentence segmentation internals.

Do not run expensive parsing on every keystroke unless the current UI already requires live metadata.

Prefer performing full analysis preprocessing on:

```text
Analyze
```

and optionally lightweight line/character counts during editing.

Do not block the UI unnecessarily for ordinary poem/prose lengths.

---

# 54. File/module separation

Follow existing project conventions.

A reasonable shape could be:

```text
src/
  analysis/
    source-structure.ts
    atomic-segmentation.ts
    analysis-types.ts
    analysis-validation.ts
    analysis-mapping.ts

src-tauri/
  src/
    gemini/
      ...
```

This is illustrative.

Do not create folders merely to match this document.

The important ownership boundaries are:

```text
source structure / local deterministic segmentation
Gemini transport
Gemini schema
response validation
graph projection
persistence
```

Do not put all logic into one React component.

---

# 55. Source-analysis API

Aim for one clear local entry point.

Conceptually:

```ts
const prepared = prepareTextForAnalysis(sourceText)
```

returning:

```ts
{
  sourceHash,
  paragraphs,
  lines,
  atomicUnits,
  modelPayload
}
```

Then:

```text
prepared atomic units
      ↓
Rust Gemini call
      ↓
model response
      ↓
validate
      ↓
resolve IDs to offsets
      ↓
persist/render
```

Keep this pipeline understandable.

---

# 56. No accidental dual segmentation systems

After migration, remove/deprecate old logic that independently derives graph points from:

```text
newline split
paragraph split
```

Do not leave:

```text
old parser used in graph
new parser used in Gemini
```

There must be one authoritative analysis pipeline.

Search for legacy helpers after implementation.

---

# 57. Structured output

Use Gemini's native structured output configuration already established in the project.

Do not ask Gemini:

```text
"return JSON inside ```json fences"
```

Do not parse Markdown fences.

The response schema should constrain:

- segment array;
- metric number ranges as much as the API/schema supports;
- movement/phase enum values if used;
- required fields.

Then run semantic validation locally.

Schema validation and semantic validation are separate layers.

---

# 58. Do not add Vertex AI

This application uses the direct Gemini API path already chosen for the project.

Do not introduce:

```text
Vertex AI
Google Cloud service accounts
Cloud auth flows
```

for this segmentation task.

Keep the current direct API-key architecture.

---

# 59. Do not move the API key into the frontend

The source segmentation can occur in React/TypeScript.

The Gemini API call remains behind the Rust/Tauri boundary.

Correct:

```text
React
  source text
  local units
      ↓
Tauri invoke
      ↓
Rust reads key from Keychain
      ↓
Gemini
```

Do not send the saved key to React.

---

# 60. Security/privacy

The application sends the text to Gemini because analysis requires it.

Make this boundary explicit in code/comments where relevant.

Do not additionally send:

- document database metadata;
- unrelated documents;
- local filesystem paths;
- API key;
- logs.

Only send what analysis needs.

---

# 61. Tests — minimum required matrix

Implement or update deterministic tests covering at least:

| Input | Key expectation |
|---|---|
| one sentence | one atomic unit |
| several sentences one line | several units |
| giant one-paragraph prose | many units |
| multiple paragraphs | paragraph IDs preserved |
| poetry, no punctuation | line units preserved |
| poetry with stanzas | stanza boundaries preserved |
| mixed punctuation | offsets valid |
| French smart punctuation | offsets valid |
| emoji/Unicode | JS selection offsets valid |
| CRLF | offsets valid |
| whitespace-only lines | no meaningless units |
| very long unpunctuated line | fallback splitting |
| valid model segmentation | resolves correctly |
| overlapping segments | rejected |
| missing unit | rejected |
| unknown unit | rejected |
| out-of-order segments | rejected |
| metric out of range | rejected |

Do not require live Gemini for deterministic test suite success.

---

# 62. Manual smoke test

After implementation:

1. run normal frontend/Rust quality gates;
2. start the Tauri app;
3. paste a long text as one paragraph;
4. click Analyze;
5. inspect logs:
   - paragraph count may be 1;
   - atomic units should be many;
   - semantic segments should usually be several;
6. verify graph has more than the previous one/two points when the text contains multiple movements;
7. switch through all four metrics;
8. click graph points;
9. verify exact corresponding source passages;
10. paste the same text with paragraph breaks added;
11. analyze again;
12. confirm formatting influences interpretation but does not mechanically dictate segment count;
13. paste a short poem with no punctuation;
14. verify line structure is preserved;
15. inspect logs for validation warnings/errors;
16. confirm no full poem text or API key was logged.

Do not compare exact Gemini scores between runs as if they are deterministic constants.

---

# 63. Quality gates

Run project-standard commands.

At minimum, where available:

```text
TypeScript typecheck
frontend lint
frontend tests
Rust fmt
cargo check
cargo clippy
Rust tests
Tauri build/check if practical
```

Use the repository's actual scripts rather than inventing parallel tooling.

Inspect the existing `logs/` output after running the app.

Fix new warnings/errors caused by this task.

---

# 64. Completion criteria

This task is complete only when all of the following are true:

- [ ] original text remains unchanged;
- [ ] paragraph/stanza structure is preserved;
- [ ] physical lines are preserved;
- [ ] deterministic atomic units exist;
- [ ] one-line prose with many sentences creates many atomic units;
- [ ] poetry without punctuation remains analyzable;
- [ ] long unpunctuated lines have a safe fallback;
- [ ] Gemini groups atomic units into semantic segments;
- [ ] paragraph count no longer determines graph point count;
- [ ] line count no longer determines graph point count;
- [ ] sentence count no longer determines graph point count;
- [ ] segments are contiguous and cover all units exactly once;
- [ ] model output is semantically validated;
- [ ] invalid output is rejected/optionally repaired once;
- [ ] offsets are resolved locally, never guessed by Gemini;
- [ ] Unicode/editor-selection behavior is tested;
- [ ] all four metrics are defined distinctly;
- [ ] graph uses semantic segments;
- [ ] graph → text selection uses deterministic offsets;
- [ ] existing manual metric overrides still work;
- [ ] movements/phases reference semantic segments if present;
- [ ] analysis persistence remains correct;
- [ ] logs expose counts/ranges, not full private text;
- [ ] tests pass;
- [ ] no unnecessary unrelated redesign was performed.

Stop after this task.

---

# Final architectural invariant

The application must end with this mental model:

```text
AUTHOR STRUCTURE
paragraphs / stanzas / lines
        │
        │ preserved
        ▼
LOCAL STRUCTURE
deterministic atomic units
        │
        │ stable IDs + exact local offsets
        ▼
LLM INTERPRETATION
semantic segments
        │
        ├── intensity
        ├── tension
        ├── valence
        └── temperature
        │
        ▼
DYNAMIC STRUCTURE
movements / phases
        │
        ▼
GRAPH
```

Never collapse these layers back into:

```text
newline = graph point
```

or:

```text
paragraph = graph point
```

The point of the system is to preserve what the author wrote while letting the analysis discover how the text actually moves.
