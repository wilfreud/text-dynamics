# Text Dynamics — Local Data Cleanup & Reset Specification

## Scope

This specification defines how **Text Dynamics** should remove its local data on macOS.

Important constraint:

> macOS does not provide a reliable application-level `onUninstall()` callback when a user drags an `.app` bundle to the Trash.

Therefore cleanup must be an explicit, user-triggered in-app operation.

---

# 1. Goal

Provide:

```text
Settings
→ Advanced
→ Delete all local data
```

This action should remove all app-owned local state, including:

```text
SQLite database
activity history
diagnostic logs
preferences
cache/temp data
Gemini API key from macOS Keychain
```

After cleanup, reopening/restarting Text Dynamics should behave like a fresh install.

The `.app` bundle itself remains installed.

---

# 2. Platform model

Do not design around:

```ts
onUninstall(() => cleanup())
```

Deleting:

```text
/Applications/Text Dynamics.app
```

normally removes the executable bundle only.

It may leave behind:

```text
~/Library/Application Support/...
~/Library/Logs/...
~/Library/Preferences/...
~/Library/Caches/...
Keychain entries
```

Therefore:

```text
app deletion ≠ full uninstall cleanup
```

---

# 3. User mental model

The user should understand:

```text
Delete all local data
```

means:

```text
reset Text Dynamics on this Mac
```

Then, if they want to fully remove the app:

```text
1. Delete all local data
2. Quit Text Dynamics
3. Delete Text Dynamics.app from Applications
```

---

# 4. Cleanup scope

Audit the actual repository/runtime first.

Identify all app-owned local state:

```text
primary SQLite DB
SQLite WAL/SHM
activity/history data
diagnostic logs
Tauri store/config
localStorage
sessionStorage
preferences
cached Gemini model catalog if persisted
app cache
temporary files
generated internal artifacts
Keychain Gemini credential
```

Do not guess paths.

Resolve them using the actual runtime configuration.

---

# 5. Do not self-delete the app bundle

Do not attempt to remove:

```text
/Applications/Text Dynamics.app
```

from inside the running app.

Reasons:

- unnecessary;
- fragile;
- permission/UX complexity;
- not required for local data cleanup.

The user deletes the app bundle normally afterward.

---

# 6. Cleanup categories

Think in these groups:

```text
A. user/project local data
B. credentials
C. history/diagnostics
D. preferences/cache
E. temporary runtime artifacts
```

---

# 7. SQLite cleanup

Before deleting the DB:

```text
1. stop accepting DB writes
2. close SQLite connections/pool
3. flush pending writes
4. delete main DB file
5. delete DB-WAL
6. delete DB-SHM
```

Do not delete an actively used DB and assume cleanup is complete.

---

# 8. SQLite path

Use the runtime-resolved application data path.

Conceptually on macOS:

```text
~/Library/Application Support/<bundle-id>/
```

but do not hardcode it.

Use Tauri/framework path APIs and the actual DB configuration.

---

# 9. Activity history

If Activity history is inside the primary SQLite DB:

```text
deleting DB deletes Activity history
```

Do not redundantly delete every row first unless required.

If history uses another DB/file, include it explicitly.

---

# 10. Diagnostic logs

Delete the entire **app-owned** diagnostic log set.

Likely locations:

```text
~/Library/Logs/Text Dynamics/
```

or:

```text
~/Library/Application Support/<bundle-id>/logs/
```

Use the actual runtime path.

Never recursively delete broad directories such as:

```text
~/Library/Logs
~/Library/Application Support
~/Library
```

---

# 11. Keychain cleanup

Delete only the Gemini API credential owned by Text Dynamics.

Use the same stable identifiers already used by the app.

Conceptually:

```text
service = text-dynamics
account = gemini-api-key
```

Use actual constants from the codebase.

Never search-and-delete unrelated Keychain items.

---

# 12. Keychain result semantics

Treat:

```text
credential missing
```

as successful cleanup.

Treat genuine errors separately:

```text
permission/access error
backend failure
unexpected Keychain error
```

Do not silently convert every failure into "already deleted".

---

# 13. Preferences

Audit all preference stores.

Possible locations:

```text
SQLite
Tauri Store plugin
JSON config
localStorage
plist-like config
```

Reset app-owned preferences such as:

```text
selected model
workspace panel sizes
window/layout preferences
History filters
graph display preferences
last selected document
```

---

# 14. localStorage

If the app uses localStorage:

Prefer deleting only Text Dynamics keys.

Example prefix:

```text
text-dynamics.*
```

Avoid blindly calling:

```ts
localStorage.clear()
```

unless the WebView storage is intentionally app-exclusive and this is documented.

---

# 15. sessionStorage

Clear app session state too.

Examples:

```text
selectedSegmentId
temporary dialog/filter state
session-scoped cached UI values
```

Most of this will disappear on restart anyway, but reset it cleanly.

---

# 16. Cache

Delete app-owned caches if present.

Examples:

```text
cached model catalog
temporary graph/export cache
analysis intermediary cache
```

Do not delete unrelated system/user caches.

---

# 17. Temporary files

Delete temporary files only when Text Dynamics can confidently identify ownership.

Do not recursively clean generic temp directories.

---

# 18. Backups

If Text Dynamics creates internal automatic backups inside app-owned storage:

Recommended:

```text
Delete all local data removes them
```

If a user manually exported a backup elsewhere:

```text
do not delete it
```

---

# 19. User-exported files

Never delete files outside app-owned locations.

Examples:

```text
~/Desktop/report.pdf
~/Documents/text-dynamics-export.json
```

These are user-owned once exported.

---

# 20. Explicit action only

Never run full cleanup automatically on:

```text
normal app close
app update
document deletion
analysis deletion
reanalysis
crash
startup
```

Only run after explicit destructive confirmation.

---

# 21. Settings placement

Recommended:

```text
Settings
  └── Advanced
      └── Delete all local data
```

Use the existing destructive-action visual language.

---

# 22. Confirmation dialog

Show exactly what will be removed.

Example:

```text
Delete all local data?

This permanently removes:
• documents and analyses
• activity history
• diagnostic logs
• preferences and local cache
• saved Gemini API key

The Text Dynamics application itself will remain installed.
```

Actions:

```text
Cancel
Delete all local data
```

---

# 23. Strong confirmation

Because documents are deleted, prevent accidental activation.

Reasonable options:

```text
second confirmation
```

or:

```text
type DELETE
```

Do not make full reset one accidental click.

---

# 24. Backend ownership

Rust/Tauri owns destructive operations.

React should only:

```text
show confirmation
invoke cleanup command
display progress/result
restart/quit
```

React should not manually delete arbitrary filesystem paths.

---

# 25. One orchestration command

Prefer one backend command conceptually:

```text
delete_all_local_data()
```

rather than multiple frontend calls:

```text
delete db
delete logs
delete key
delete config
...
```

Central orchestration improves safety and consistency.

---

# 26. Cleanup sequence

Recommended:

```text
cleanup.start
      ↓
freeze writes
      ↓
close DB
      ↓
flush/stop logger if possible
      ↓
delete DB + WAL + SHM
      ↓
delete caches/preferences/config
      ↓
delete diagnostic logs
      ↓
delete Keychain credential
      ↓
clear in-memory state
      ↓
restart or quit
```

Exact ordering may vary depending on resource lifecycle.

---

# 27. Freeze writes

While cleanup runs, prevent:

```text
Analyze
Save
Create Document
Delete Document
settings mutation
activity inserts
new diagnostic-heavy operations
```

Do not allow the app to recreate data halfway through deletion.

---

# 28. Logger lifecycle problem

The logger may itself have an open file handle.

Audit whether the current logging stack can:

```text
flush
close
stop file sink
```

before deleting logs.

If it can, do so.

---

# 29. If logger cannot be cleanly stopped

Possible safe strategy:

```text
1. delete everything else
2. mark log cleanup pending
3. quit
4. on next startup, before normal logger initialization:
   delete old logs
5. continue fresh launch
```

Use this only if necessary.

Do not create complexity if logs can simply be closed and removed.

---

# 30. Pending cleanup marker

If a deferred deletion is genuinely required, use one minimal marker.

Conceptually:

```text
cleanup_pending = true
```

At next startup:

```text
minimal bootstrap
→ finish pending deletions
→ remove marker
→ initialize normal app
```

Do not leave the marker forever.

---

# 31. Activity logging during cleanup

You may write:

```text
cleanup.started
```

before destroying history.

Do not recreate Activity DB just to record:

```text
cleanup.completed
```

after deleting it.

The UI result is sufficient.

---

# 32. Diagnostic logging during cleanup

Similarly:

```text
cleanup.started
```

may be logged before deleting diagnostics.

After log deletion, avoid recreating old-style logs unless the app remains running.

Preferred:

```text
cleanup success
→ restart/quit promptly
```

---

# 33. Restart behavior

Preferred UX after successful cleanup:

```text
Local data deleted.
Text Dynamics will restart.
```

Then restart into fresh-install state.

If reliable restart support is not already present:

```text
quit and ask user to reopen
```

is fine.

---

# 34. Fresh-install invariant

After cleanup + restart:

```text
no documents
no analyses
no activity history
no old diagnostics
no configured API key
default settings
default workspace layout
no selected document
no selected segment
new session_id
```

---

# 35. Update behavior

A normal app update must **not** trigger cleanup.

Replacing:

```text
Text Dynamics 0.1.0
```

with:

```text
Text Dynamics 0.1.1
```

should preserve:

```text
documents
analyses
history
logs
preferences
Keychain key
```

unless a normal schema migration is required.

---

# 36. Bundle identifier stability

Keep the app identifier stable.

Cleanup should use paths and Keychain identity associated with the same installed app identity.

Changing the bundle identifier can create apparently "orphaned" old data.

---

# 37. Runtime path inventory

Before implementing cleanup, document the actual paths/identities.

Example internal inventory:

```text
Database:
  /.../Application Support/.../text-dynamics.db

Logs:
  /.../Logs/Text Dynamics/

Preferences:
  /.../Application Support/.../prefs.json

Keychain:
  service=text-dynamics
  account=gemini-api-key
```

Never include the secret itself.

---

# 38. Central cleanup manifest

If useful, centralize targets.

Conceptually:

```rust
struct CleanupTargets {
    database_path: PathBuf,
    log_dir: PathBuf,
    cache_dir: Option<PathBuf>,
    config_path: Option<PathBuf>,
}
```

Do not scatter dangerous delete paths across unrelated code.

---

# 39. Safety: app-owned paths only

Before recursive deletion, verify the path belongs to Text Dynamics.

Allowed conceptual roots:

```text
Application Support/<bundle-id>/
Logs/Text Dynamics/
Caches/<bundle-id>/
```

Never recursively delete without validating ownership.

---

# 40. Dangerous path rejection

Abort if a target resolves to something suspiciously broad:

```text
/
~
~/Library
~/Library/Application Support
~/Library/Logs
~/Documents
~/Desktop
```

A path-resolution bug must fail closed.

---

# 41. Symlink safety

Do not follow symlinks outside app-owned roots during recursive deletion.

Use safe filesystem operations.

---

# 42. Idempotence

Cleanup must be safe to run more than once.

Missing resources are not failures.

Expected second run:

```text
database: already_missing
logs: already_missing
keychain: already_missing
preferences: already_missing
```

---

# 43. Result model

Return structured per-target status.

Conceptually:

```json
{
  "database": "deleted",
  "logs": "deleted",
  "preferences": "deleted",
  "cache": "already_missing",
  "keychain": "deleted"
}
```

Suggested statuses:

```text
deleted
already_missing
failed
skipped
```

---

# 44. Partial failures

Example:

```text
DB deleted
logs deleted
Keychain deletion failed
```

Do not report full success.

Show a concise partial failure result and offer retry.

---

# 45. Retry

Retry should be safe.

Already-deleted resources should simply remain clean.

Do not recreate data during retry.

---

# 46. User result UI

Full success:

```text
All local Text Dynamics data has been deleted.
```

Partial success:

```text
Most local data was removed, but one item could not be deleted.
```

Then show concise status details.

---

# 47. Error details

Do not expose massive raw OS errors in the primary UI.

Provide safe summaries.

Technical details may remain in memory/dev diagnostics during the current run.

Remember that persistent logs themselves may be intentionally deleted.

---

# 48. Keychain cleanup

After reset, Keychain status must be:

```text
missing / not configured
```

Do not leave a frontend boolean saying:

```text
configured = true
```

---

# 49. UI state reset

Clear current in-memory state:

```text
currentDocument
currentAnalysis
selectedSegmentId
history filters
model selection if persisted
workspace layout
```

Prefer restart/quit immediately after successful cleanup to guarantee clean memory.

---

# 50. Clipboard

Do not clear system clipboard.

It is not app-owned state.

---

# 51. macOS/system data

Do not attempt to delete:

```text
system crash reports
macOS Recent Items
global browser/WebKit state outside app sandbox
other applications' caches
```

Only remove Text Dynamics-owned data.

---

# 52. Exported diagnostics

If the user previously exported diagnostics to Desktop/Documents:

```text
leave them untouched
```

They are no longer app-managed internal storage.

---

# 53. No privileged helper

Do not require root/admin privileges.

Text Dynamics data should live in user-writable locations.

---

# 54. No launch daemon

Do not install a background agent merely to detect later uninstall.

That would create more leftover state than the app currently has.

---

# 55. No uninstall watcher

Do not watch:

```text
/Applications/Text Dynamics.app
```

for deletion.

There is no robust value in this approach.

---

# 56. No self-destruct architecture

Do not attempt:

```text
app deletes itself
```

The clean pattern is:

```text
cleanup data
quit
user deletes app bundle
```

---

# 57. User-facing helper text

Settings may explain:

```text
Removing Text Dynamics from Applications does not automatically remove its local data from macOS. Use this option first if you want a complete local reset.
```

Keep it concise.

---

# 58. Optional selective cleanup

Future separate actions may include:

```text
Clear logs only
Clear history only
Reset preferences
Remove API key
```

Do not let those complicate the first implementation.

The required operation is full local reset.

---

# 59. Cleanup lock

Prevent concurrent resets.

If cleanup is already running:

```text
return cleanup_in_progress
```

Do not run two recursive deletes simultaneously.

---

# 60. Progress UI

Simple steps are enough:

```text
Closing database…
Removing documents…
Removing logs…
Removing preferences…
Removing API key…
```

Do not fake percentages.

---

# 61. SQLite connection test

Verify active connections are actually closed before removal.

Do not rely on macOS unlink semantics.

The intended lifecycle matters even if deletion technically succeeds with an open file.

---

# 62. WAL/SHM

If present, delete:

```text
database.db-wal
database.db-shm
```

along with the main database.

Do not leave sidecar files behind.

---

# 63. Fresh DB recreation

On next launch:

```text
migrations run
fresh empty DB is created
```

Verify all default tables/bootstrap paths still work.

---

# 64. Dev vs release identity

Audit whether:

```text
pnpm tauri dev
```

and installed release use the same app data location/identifier.

If separate:

```text
dev cleanup only cleans dev data
release cleanup only cleans release data
```

Document behavior.

---

# 65. Keychain dev/release identity

Similarly audit whether dev and release share the same Keychain service/account.

Do not accidentally delete an unrelated credential namespace.

---

# 66. Installed-build verification

Cleanup must be tested in the actual built `.app`.

Runtime paths and Keychain behavior can differ from dev.

---

# 67. Manual full-reset test

1. Install release build.
2. Configure Gemini API key.
3. Create several documents.
4. Run analyses.
5. Generate Activity history.
6. Generate Diagnostics logs.
7. Change workspace layout/preferences.
8. Open Settings > Advanced.
9. Choose Delete all local data.
10. Confirm.
11. Wait for completion/restart.
12. Reopen.
13. Confirm no documents.
14. Confirm no analyses.
15. Confirm no previous Activity.
16. Confirm no old Diagnostics.
17. Confirm API key is missing.
18. Confirm default layout/settings.
19. Confirm new session ID.
20. Confirm app remains installed.

---

# 68. Idempotence test

Run full cleanup again immediately.

Expected:

```text
success / already clean
```

No crash.

---

# 69. Update-preservation test

Without running cleanup:

1. create documents;
2. configure key;
3. install newer app build over old build;
4. reopen.

Expected:

```text
documents remain
key remains
history/logs remain
preferences remain
```

---

# 70. Keychain verification

Use the actual stable service/account constants.

A safe macOS existence check may be:

```bash
security find-generic-password -s "text-dynamics" -a "gemini-api-key"
```

Do not use:

```bash
-w
```

because it prints the secret.

---

# 71. DB verification

After cleanup and before restart:

```text
main DB absent
WAL absent
SHM absent
```

After restart:

```text
new empty DB exists
```

---

# 72. Logs verification

After cleanup:

```text
old diagnostic files absent
```

After restart:

```text
new clean diagnostic stream starts
```

No old entries.

---

# 73. Preference verification

After cleanup:

```text
default model state
default panel sizing
default filters
no stale document selection
```

---

# 74. Export preservation test

Create/export a file to:

```text
~/Desktop
```

Run cleanup.

Expected:

```text
export survives
```

---

# 75. Dangerous-path test

Mock or force one cleanup target to resolve to:

```text
~/Library
```

Expected:

```text
deletion refused
```

Never recursively delete broad user/system paths.

---

# 76. Partial failure test

Simulate Keychain deletion failure.

Expected:

```text
filesystem cleanup succeeds
result reports keychain failure
user sees partial cleanup
retry remains possible
```

---

# 77. Logging integration

The Logging specification defines:

```text
SQLite Activity history
rotating diagnostic files
```

Full cleanup must remove both.

No special retention exception applies after explicit full reset.

---

# 78. UX wording

Prefer:

```text
Delete all local data
```

over:

```text
Uninstall
```

because the app bundle remains installed.

Optionally add:

```text
Afterwards, remove Text Dynamics from Applications if you also want to uninstall the app.
```

---

# 79. Acceptance criteria

- [ ] explicit Settings > Advanced reset action exists;
- [ ] destructive confirmation is required;
- [ ] Rust/Tauri owns cleanup;
- [ ] writes are frozen during cleanup;
- [ ] SQLite connections are closed;
- [ ] DB/WAL/SHM are removed;
- [ ] Activity history is removed;
- [ ] diagnostic logs are removed;
- [ ] preferences are reset;
- [ ] caches/temp files are removed where applicable;
- [ ] Gemini Keychain credential is removed;
- [ ] missing resources count as clean;
- [ ] cleanup is idempotent;
- [ ] dangerous paths are rejected;
- [ ] symlink traversal outside app roots is prevented;
- [ ] exported user files remain untouched;
- [ ] app bundle remains installed;
- [ ] success ends with restart/quit;
- [ ] next launch behaves like first install;
- [ ] normal app updates preserve data;
- [ ] documentation does not claim a reliable macOS uninstall callback exists.

---

# Final invariant

```text
DELETE APP BUNDLE
      │
      └── removes the application executable

DELETE ALL LOCAL DATA
      │
      ├── SQLite
      ├── Activity history
      ├── diagnostic logs
      ├── preferences
      ├── cache/temp
      └── Keychain credential

DELETE ALL LOCAL DATA
      +
delete .app from /Applications
      =
practical complete uninstall
```

There is no reliable `onUninstall()` hook to depend on.

The correct architecture is an explicit, safe, idempotent local cleanup operation performed before the user removes the application bundle.
