# Text Dynamics — Logging & In-App History Specification

## Scope

This specification defines the logging architecture for the installed Tauri + React desktop app **Text Dynamics**.

It covers:

- persistent diagnostic logs in release builds;
- structured user-facing history;
- session and document scoping;
- retention/rotation;
- in-app History UI;
- search and highlighting;
- privacy/redaction;
- behavior after build/install/update;
- failure modes and acceptance checks.

---

# 1. Architecture

Use **two complementary logging channels**:

```text
                         TEXT DYNAMICS
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ACTIVITY / HISTORY            DIAGNOSTIC LOGS
             SQLite                    rotating files
                │                           │
                └─────────────┬─────────────┘
                              ▼
                      HISTORY / LOG VIEWER
```

Do not use SQLite as the only diagnostic sink.

Reason:

```text
if SQLite fails
→ logging must still work
```

---

# 2. Activity / History

Activity events are meaningful user/product actions.

Examples:

```text
app.started
document.created
document.opened
document.saved
document.deleted
analysis.started
analysis.completed
analysis.failed
metric.override_changed
metric.override_reset
settings.model_changed
keychain.key_saved
keychain.key_deleted
```

These belong in SQLite because they are:

- structured;
- queryable;
- persistent;
- filterable by session/document;
- useful to the user.

---

# 3. Diagnostics

Technical logs describe implementation/runtime behavior.

Examples:

```text
SQLite connection failed
Keychain read failed
Gemini returned HTTP 429
structured-output validation failed
Tauri plugin initialization failed
filesystem error
unexpected internal state
panic/crash context
```

These should primarily go to rotating local files.

---

# 4. Session scope

Every application startup generates a fresh `session_id`.

Example:

```text
sess_01K...
```

Every activity event and diagnostic log written during that process should carry the same session ID.

A new launch creates a new one.

Do not persist one global session ID forever.

---

# 5. Document scope

Any event related to a document should carry:

```text
document_id
```

Examples:

```text
analysis.started
analysis.completed
document.saved
metric.override_changed
```

App-global events leave `document_id = null`.

Do **not** create one file per document.

---

# 6. Recommended SQLite table

Adapt to the existing DB layer and migrations.

```sql
CREATE TABLE activity_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  document_id TEXT,

  category TEXT NOT NULL,
  event_name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',

  message TEXT,
  metadata_json TEXT,

  source TEXT NOT NULL DEFAULT 'app'
);
```

Suggested indexes:

```sql
CREATE INDEX idx_activity_created_at
ON activity_events(created_at);

CREATE INDEX idx_activity_session
ON activity_events(session_id);

CREATE INDEX idx_activity_document
ON activity_events(document_id);

CREATE INDEX idx_activity_level
ON activity_events(level);

CREATE INDEX idx_activity_event
ON activity_events(event_name);
```

---

# 7. Event fields

## `id`

Use a unique ID such as:

```text
ULID
UUIDv7
UUIDv4
```

## `created_at`

Store UTC as ISO-8601 / RFC3339.

Example:

```text
2026-09-28T11:42:13.421Z
```

Render local time in UI.

## `session_id`

Identifies one application run.

## `document_id`

Nullable; identifies the relevant document.

## `category`

Small stable set:

```text
app
document
analysis
model
storage
settings
security
ui
```

## `event_name`

Machine-readable.

Good:

```text
analysis.completed
document.saved
settings.model_changed
```

## `level`

Use:

```text
debug
info
warn
error
```

## `message`

Optional human-readable text.

## `metadata_json`

Small structured metadata only.

Good:

```json
{
  "model": "gemini-...",
  "source_chars": 1824,
  "atomic_units": 17,
  "semantic_segments": 7,
  "duration_ms": 1240
}
```

Bad:

```json
{
  "full_source_text": "..."
}
```

---

# 8. Diagnostic file logs

Persist technical diagnostics outside SQLite.

On macOS, resolve the actual application log path at runtime using Tauri/framework path APIs.

Typical locations are conceptually:

```text
~/Library/Logs/Text Dynamics/
```

or:

```text
~/Library/Application Support/<bundle-id>/logs/
```

Do not hardcode broad user paths if framework APIs already provide correct app-specific paths.

---

# 9. File format

Prefer JSON Lines if practical:

```json
{"ts":"...","level":"info","session_id":"...","document_id":"...","component":"analysis","event":"analysis.request.started","message":"Gemini request started"}
{"ts":"...","level":"warn","session_id":"...","component":"analysis","event":"analysis.validation.retry","message":"Repair retry required"}
```

If the existing Tauri logging stack uses structured plain text, keep it rather than introducing a second competing logger solely for JSONL.

---

# 10. Diagnostic fields

Where applicable include:

```text
timestamp
level
session_id
document_id
component
event
message
metadata
```

Example:

```text
[2026-09-28T11:42:14.812Z]
[WARN]
[session=sess_x]
[doc=doc_42]
[analysis]
[event=analysis.validation.retry]
Structured output required one repair retry
```

---

# 11. Startup order

Recommended:

```text
1. initialize minimal persistent diagnostic logger
2. create session_id
3. log app.started
4. initialize SQLite
5. run migrations
6. initialize application state
7. insert user-facing app.started activity if appropriate
```

This allows SQLite startup failures to still be logged.

---

# 12. Shutdown

On graceful shutdown, optionally emit:

```text
app.stopped
```

Then flush logs if the logging stack supports it.

Do not depend on graceful shutdown for correctness.

---

# 13. Rotation

Diagnostic logs must be bounded.

Good initial policy:

```text
5–10 MB per file
keep 5–10 files
```

or:

```text
daily rotation
keep 7–30 days
```

Choose the simplest option supported by the existing logger.

Never allow logs to grow indefinitely.

---

# 14. SQLite retention

Also bound activity history.

Reasonable initial policy:

```text
retain 90 days
```

or:

```text
retain latest 50,000 events
```

Do cleanup at startup or another low-frequency maintenance point.

Do not run a retention delete after every single event.

---

# 15. Privacy rules

Never log by default:

```text
Gemini API key
Authorization headers
Keychain secret
full source text
full poem/document
full Gemini request
full Gemini response
passwords
tokens
cookies
credentials
```

Prefer IDs/counts over raw content.

---

# 16. Safe analysis logging

Good:

```text
analysis.started
analysis.completed
analysis.failed
analysis.validation_retry
```

Safe metadata:

```json
{
  "model": "gemini-...",
  "http_status": 200,
  "source_chars": 1842,
  "segments": 7,
  "duration_ms": 1240
}
```

Do not log the poem/text itself.

---

# 17. Keychain logging

Good:

```text
keychain.read.success
keychain.read.missing
keychain.write.success
keychain.delete.success
```

Never log:

```text
api_key
key prefix
key suffix
Authorization header
```

---

# 18. SQLite failure path

If SQLite fails:

```text
SQLite error
   ↓
diagnostic file logger
   ↓
safe UI error
```

Do not attempt to log the SQLite failure only into SQLite.

---

# 19. Rust ownership

The Rust/Tauri backend should own:

- persistent file logging;
- activity persistence;
- history queries;
- diagnostic file access;
- retention;
- filesystem access;
- redaction/safety boundaries.

React should not directly read arbitrary filesystem locations.

---

# 20. React ownership

React should own:

- History button;
- History dialog/modal;
- search field;
- filters;
- pagination;
- match highlighting;
- row rendering;
- selected session/document state.

---

# 21. History button

Add:

```text
[History] [Settings]
```

near the existing Settings action.

Use the app’s existing top-bar design.

---

# 22. History dialog

Recommended structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ History                                              [×]  │
├─────────────────────────────────────────────────────────────┤
│ [Activity] [Diagnostics]                                  │
│                                                             │
│ Search [_____________________________]                      │
│                                                             │
│ Session  [Current ▼]   Document [Current ▼]               │
│ Level    [All ▼]       Category [All ▼]                   │
├─────────────────────────────────────────────────────────────┤
│ 11:42 INFO  Analysis completed                             │
│             8 segments · 1.24s · gemini-...                │
│                                                             │
│ 11:41 WARN  Analysis repair retry                          │
│                                                             │
│ 11:40 INFO  Document saved                                 │
└─────────────────────────────────────────────────────────────┘
```

---

# 23. Tabs

Use two views:

```text
Activity
Diagnostics
```

## Activity

User/product history from SQLite.

## Diagnostics

Technical runtime logs from rotating files.

Do not mix hundreds of technical lines into the default Activity view.

---

# 24. Search

Search across appropriate fields.

For Activity:

```text
event_name
message
category
metadata_json
```

For Diagnostics:

```text
event
message
component
metadata
```

Case-insensitive if practical.

---

# 25. Yellow highlight

Search matches should be highlighted in yellow.

Use restrained yellow compatible with the app’s monochrome UI.

Example implementation:

```html
<mark>Gemini</mark>
```

or equivalent React rendering.

Do not mutate the stored event text.

---

# 26. Filters

Support:

```text
session
document
level
category/component
search
```

Recommended default:

```text
Session: Current
Document: Current if one is open, otherwise All
Level: All
```

---

# 27. Friendly session labels

Do not force the user to read raw IDs.

Render:

```text
Current session
Today 11:36
Yesterday 22:14
Sep 26, 18:08
```

Raw session ID may appear in details.

---

# 28. Deleted documents

History may outlive a deleted document.

Do not break rendering if a document no longer exists.

Show:

```text
Deleted document
```

plus the stored ID if useful.

Avoid destructive FK cascade unless intentionally chosen.

---

# 29. Pagination

Do not load the entire history table at once.

Start with:

```text
100–200 rows
```

Then use:

```text
Load more
```

or an existing pagination pattern.

---

# 30. Live updates

While History is open, new events should appear without full-page reload.

Recommended:

```text
Rust writes event
   ↓
Rust emits Tauri event / invalidates query
   ↓
React updates list
```

Do not tail files directly from React.

---

# 31. Details view

Clicking a history row may show:

```text
timestamp
event name
level
session
document
component/category
metadata
```

Render metadata as a small key/value list or formatted JSON.

Do not clutter the main list with raw JSON.

---

# 32. Release build requirement

Persistent logging must work in:

```bash
pnpm tauri build
```

and after installing the `.app`.

It must not depend on:

```text
tee
terminal stdout
pnpm dev:logged
Vite dev server
```

Those are developer conveniences only.

---

# 33. Dev vs release levels

Recommended:

```text
dev:
  debug/info/warn/error

release:
  info/warn/error
```

Avoid verbose debug spam in installed builds unless explicitly enabled.

---

# 34. Frontend logs

Frontend errors should be forwarded to persistent backend logging if the existing project already has this capability.

Do not rely solely on browser DevTools console.

---

# 35. Redaction helper

Centralize secret redaction where useful.

Sensitive key names include:

```text
api_key
authorization
token
secret
password
credential
cookie
```

Case-insensitive.

Do not rely on every logging callsite remembering all rules.

---

# 36. Activity logging failures

If writing an Activity event fails:

```text
write warning to diagnostic file
```

Do not fail the actual user action solely because history persistence failed.

Example:

```text
document save succeeds
activity insert fails
→ save remains successful
```

---

# 37. Diagnostic logger failure

Avoid recursive failure:

```text
file logger fails
→ do not try logging logger failure through same file logger repeatedly
```

Fallback to stderr where appropriate.

---

# 38. Event naming

Use one convention consistently:

```text
domain.action
```

Examples:

```text
app.started
document.saved
analysis.started
analysis.completed
analysis.failed
settings.model_changed
```

---

# 39. Suggested initial event catalog

```text
app.started
app.stopped

document.created
document.opened
document.saved
document.renamed
document.deleted

analysis.started
analysis.completed
analysis.failed
analysis.validation_retry

metric.override_changed
metric.override_reset

settings.model_changed

keychain.key_saved
keychain.key_deleted

storage.database_opened
storage.database_error
```

Not every diagnostic event belongs in Activity.

---

# 40. Do not log UI noise

Avoid user-facing history entries for:

```text
popover.opened
button.hovered
tab.hovered
render.completed
```

History should remain meaningful.

---

# 41. Search query API

Backend queries must be bounded.

Conceptually:

```ts
listActivityEvents({
  query?,
  sessionId?,
  documentId?,
  level?,
  category?,
  limit?,
  offset?
})
```

and:

```ts
listDiagnosticLogs({
  query?,
  sessionId?,
  documentId?,
  level?,
  component?,
  limit?,
  cursor?
})
```

---

# 42. Log path utility

Optional useful Settings > Advanced action:

```text
Open Logs Folder
```

Use safe Tauri shell/path APIs.

---

# 43. Update behavior

Replacing the app with a newer build must preserve:

```text
SQLite documents
activity history
diagnostic logs
preferences
Keychain credential
```

unless explicit migration/cleanup says otherwise.

---

# 44. No remote telemetry

Do not add:

```text
Sentry
Datadog
OpenTelemetry cloud exporter
ELK
Loki
remote analytics
```

This is a local app unless separately requested.

---

# 45. Cleanup integration

The separate local-data cleanup flow must be able to delete:

```text
activity history
diagnostic logs
```

Do not make history impossible to clean.

---

# 46. Manual smoke test

1. Build release.
2. Install into `/Applications`.
3. Launch.
4. Open/create document.
5. Run analysis.
6. Open History.
7. Confirm Activity entries.
8. Confirm Diagnostics entries.
9. Search `analysis`.
10. Confirm yellow highlight.
11. Filter current session.
12. Filter current document.
13. Close app.
14. Reopen.
15. Confirm previous session still visible.
16. Verify new session ID exists.
17. Replace app with newer build.
18. Reopen.
19. Confirm history/logs remain.
20. Inspect log files.
21. Verify no API key or document text appears.

---

# 47. Acceptance criteria

- [ ] diagnostic logs persist in installed release builds;
- [ ] diagnostic logs survive SQLite failure;
- [ ] diagnostic logs rotate/prune;
- [ ] Activity history persists in SQLite;
- [ ] every startup has a fresh session ID;
- [ ] document-scoped events carry document ID;
- [ ] no one-file-per-document design;
- [ ] no one-file-per-session requirement;
- [ ] Activity retention is bounded;
- [ ] secrets are redacted;
- [ ] document source text is not logged by default;
- [ ] History button exists near Settings;
- [ ] History has Activity and Diagnostics tabs;
- [ ] search works;
- [ ] search matches are highlighted in yellow;
- [ ] session filtering works;
- [ ] document filtering works;
- [ ] level/category/component filtering works where applicable;
- [ ] release logging does not depend on dev shell scripts;
- [ ] updates preserve logs/history.

---

# Final invariant

```text
ACTIVITY / HISTORY
        ↓
      SQLite
        ↓
 searchable, structured, scoped by session/document

TECHNICAL DIAGNOSTICS
        ↓
 rotating local files
        ↓
 survives DB failures, bounded, redacted

BOTH
        ↓
 in-app History viewer
```

The app must remain diagnosable after it is built and installed, while the user gets a clean local searchable history without leaking private text or credentials.
