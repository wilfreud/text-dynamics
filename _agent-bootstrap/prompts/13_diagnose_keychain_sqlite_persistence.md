# Task 13 — Diagnose and fix Keychain persistence + verify SQLite runtime storage

Execute only this task.

The goal is to make credential persistence and local storage behavior deterministic in development and production.

The application is a local Tauri desktop application. The Gemini API key must survive:

- frontend hot reloads;
- Vite/dev-server restarts;
- `tauri dev` restarts;
- Rust recompilation;
- application close/reopen;
- machine reboot.

The API key must **not** be stored in SQLite, localStorage, source files, `.env`, logs, or frontend state beyond the temporary value typed by the user before save.

This task must also verify where the application's SQLite database is actually stored at runtime and document that path clearly.

Do not redesign unrelated application behavior.

---

# Primary objectives

By the end of this task:

1. Gemini credential persistence is backed by the native OS credential store on macOS.
2. Keychain lookup uses stable identifiers.
3. The frontend never needs the user to re-enter a correctly saved key after normal restarts.
4. Missing-key state is derived from the credential store, not stale frontend/local state.
5. keychain failures are surfaced and logged safely.
6. no API key value can appear in logs.
7. SQLite location and initialization are verified against the actual installed Tauri/SQL stack.
8. startup logs expose **safe diagnostic metadata**:
   - whether a credential exists;
   - which credential service/account identifiers are being used;
   - which database path is being used;
   - whether the database opened successfully;
   - never the secret itself.
9. developer documentation explains how to verify both systems manually.

---

# Read before changing code

First inspect the actual project.

Read:

- `AGENTS.md`;
- `.agents/skills/tiger-style/SKILL.md`;
- Rust/Tauri guardrail skills already installed;
- observability/debugging skill already installed;
- `src-tauri/Cargo.toml`;
- `src-tauri/tauri.conf.json` or equivalent config;
- Rust credential/keychain implementation;
- Rust commands exposed to the frontend;
- frontend Settings/API-key implementation;
- application startup/bootstrap code;
- SQLite/database initialization code;
- migration configuration;
- `package.json`;
- current logs;
- `.gitignore`.

Also search the repository for all occurrences of:

```text
GEMINI_API_KEY
api_key
apiKey
keyring
keychain
credential
secret
Database.load
sqlite:
.db
.sqlite
app_data
appData
app_config
appConfig
localStorage
sessionStorage
```

Do not assume the current implementation matches the intended architecture.

Document what actually exists before modifying it.

---

# Authoritative references

Use the current installed dependency versions and official documentation as the source of truth.

Relevant references:

## Rust keyring ecosystem

https://docs.rs/keyring/latest/keyring/

Current `keyring` supports native secure stores across macOS, Windows, and Linux.

For macOS, the Apple-native keyring provider documents the native macOS Keychain store:

https://docs.rs/apple-native-keyring-store/latest/apple_native_keyring_store/

Important distinction:

- macOS has a legacy/native Keychain store;
- macOS also has Protected Data storage intended for appropriately signed/sandboxed applications;
- for ordinary development/non-provisioned desktop applications, the native Keychain-compatible backend is generally the simpler option.

Inspect the crate/version actually installed before changing features.

## Tauri SQL

https://v2.tauri.app/plugin/sql/

API reference:

https://v2.tauri.app/reference/javascript/sql/

Important: Tauri SQL SQLite paths are runtime application paths, not repository-relative files in normal usage.

The exact base directory semantics have changed/documented differently across versions. Therefore:

> Inspect the installed plugin version and resolve/log the actual path at runtime instead of assuming a path copied from an old tutorial.

## Tauri filesystem/path concepts

https://v2.tauri.app/plugin/file-system/

Tauri exposes runtime directories such as:

```text
$APPCONFIG
$APPDATA
$APPLOCALDATA
$APPLOG
```

Use the actual application path resolver to determine the concrete path on the current machine.

---

# Part A — Audit the current credential implementation

Before changing code, answer internally from the repository:

1. Which Rust crate/library currently stores the Gemini API key?
2. Which exact crate version?
3. Which features are enabled?
4. On macOS, which credential store backend is actually used?
5. What `service` identifier is used?
6. What `account`/username identifier is used?
7. Are either of those identifiers dynamically generated?
8. Do they depend on:
   - dev server port;
   - process ID;
   - repo path;
   - bundle identifier;
   - build profile;
   - app version;
   - random UUID;
   - frontend session?
9. Is the key written successfully?
10. Is write failure ignored?
11. Is the key read during startup?
12. Is read failure being interpreted incorrectly as "missing"?
13. Does frontend state overwrite the startup result?
14. Is any secret persisted in localStorage/SQLite by mistake?
15. Can the secret reach logs through debug formatting or error objects?

Do not fix blindly before this audit.

---

# Part B — Stable credential identity

Use explicit stable identifiers.

Recommended conceptual constants:

```rust
const KEYCHAIN_SERVICE: &str = "text-dynamics";
const GEMINI_API_KEY_ACCOUNT: &str = "gemini-api-key";
```

If the project already has stable sensible identifiers, preserve them.

The critical invariant is:

```text
same installation + same user + same credential purpose
                  ↓
same service/account identity
```

Normal dev rebuilds must not change them.

Do **not** derive them from unstable values such as:

```text
PID
random UUID
Vite port
temporary build path
Cargo target hash
timestamp
```

Be careful with bundle identifiers:

```text
com.example.text-dynamics
com.example.text-dynamics.dev
```

Using different identifiers between dev/prod can be intentional, but then they represent separate credentials.

For this small local project, prefer one clearly documented credential identity unless there is an existing deliberate reason for dev/prod isolation.

If dev and production intentionally use different Keychain records, document this and make the UI behavior unsurprising.

---

# Part C — Credential service abstraction

Credential storage should live behind a small Rust boundary.

Conceptual API:

```rust
pub trait CredentialStore {
    fn save_gemini_api_key(&self, secret: &str) -> Result<(), CredentialError>;
    fn has_gemini_api_key(&self) -> Result<bool, CredentialError>;
    fn get_gemini_api_key(&self) -> Result<Option<SecretString>, CredentialError>;
    fn delete_gemini_api_key(&self) -> Result<(), CredentialError>;
}
```

Do not overengineer this trait if the current code can achieve the same separation with a small module.

The architectural invariant matters more than the exact shape:

```text
React
  ↓ commands
Rust application boundary
  ↓
credential module
  ↓
native OS credential store
```

Gemini network code obtains the secret internally from Rust.

The secret should not make a round trip:

```text
Keychain -> Rust -> React -> Rust -> Gemini
```

Prefer:

```text
Keychain -> Rust -> Gemini
```

---

# Part D — Save flow

The settings flow should behave like:

```text
user types key
      ↓
frontend invoke(save_api_key)
      ↓
Rust validates basic non-empty input
      ↓
Keychain write
      ↓
read-after-write verification
      ↓
return safe result
      ↓
frontend clears plaintext field
      ↓
UI shows Configured
```

## Read-after-write verification

After saving, verify that the credential can immediately be read from the same service/account record.

Do not compare/log plaintext.

Conceptually:

```rust
write(secret)?;
let present = read()?.is_some();

if !present {
    return Err(...);
}
```

If practical, compare the retrieved secret in memory to the submitted secret, then immediately release/drop it.

Never print either value.

A save operation must not report success when the Keychain operation failed.

---

# Part E — Startup flow

At application/UI startup:

```text
app starts
   ↓
frontend requests credential status
   ↓
Rust checks Keychain
   ↓
Configured | Missing | Error
   ↓
frontend renders state
```

Use a status richer than a bare boolean where useful:

```ts
type ApiKeyStatus =
  | { state: "configured" }
  | { state: "missing" }
  | { state: "error"; message: string }
```

Why:

```text
Keychain unavailable
```

is not equivalent to:

```text
No key saved
```

Do not silently collapse storage errors into "Missing API Key".

This distinction is essential for diagnosing the issue described by this task.

---

# Part F — Frontend state rules

The frontend must not become a competing source of truth.

Bad:

```text
localStorage.apiKeyConfigured = true
```

Bad:

```text
React state defaults to false
and never asks Rust on startup
```

Good:

```text
on app/settings bootstrap
   ↓
invoke credential_status
   ↓
render returned state
```

The typed plaintext API key can exist temporarily in component state while the user edits the field.

After successful save:

```text
clear the input
```

Do not repopulate it from Keychain.

A settings field can show:

```text
••••••••••••
```

as a UI representation, but this must not mean that the actual secret was sent to the frontend.

---

# Part G — Delete/replace behavior

Support deterministic replacement:

```text
Save new key
   ↓
overwrite same Keychain service/account record
```

Support delete/remove if such an action exists:

```text
Delete
   ↓
remove native credential
   ↓
status becomes Missing
```

If no delete action is currently exposed in product UX, the backend helper may still be useful for diagnostics, but do not add unrelated UI unless appropriate.

---

# Part H — macOS-specific diagnosis

On macOS, explicitly diagnose these failure classes.

## 1. Record never written

Symptoms:

```text
save appears successful
restart
key missing
```

Check whether errors are swallowed.

---

## 2. Different service/account on next run

Log only identifiers, never secrets:

```text
credential service=text-dynamics
credential account=gemini-api-key
credential status=configured
```

Compare across restarts.

---

## 3. Different backend selected in development

Verify which `keyring` feature/backend is compiled on macOS.

Inspect Cargo features.

The current keyring ecosystem has Apple-native stores; do not assume merely depending on `keyring` guarantees the exact backend you intended.

---

## 4. Keychain access error misclassified as missing

Distinguish:

```text
NoEntry
```

from:

```text
permission denied
backend unavailable
decoding error
security framework error
```

Map only the actual "entry does not exist" condition to `Missing`.

Map all other failures to `Error`.

---

## 5. App identity/access-control changes

Code signing, sandboxing, entitlements, and choice between legacy Keychain vs Protected Data can change access behavior.

For development:

- inspect whether the Tauri dev executable is unsigned/ad-hoc signed;
- inspect whether the chosen keyring backend expects protected-data entitlements;
- do not introduce production-only protected-data requirements into ordinary dev mode unless intentionally configured.

Prefer the simplest native Keychain backend compatible with development for this project.

---

## 6. Multiple duplicate records

During debugging, old service/account naming schemes may have left duplicate Keychain entries.

Do not delete arbitrary user credentials.

If duplicates for this app are detected by known historical identifiers:

- document them;
- optionally provide a one-time migration;
- do not silently remove unrelated Keychain records.

---

# Part I — Safe diagnostic logging

Add safe startup diagnostics.

Example:

```text
[credential] backend=macos-keychain
[credential] service=text-dynamics
[credential] account=gemini-api-key
[credential] status=configured
```

Never:

```text
[credential] key=AIza...
```

Never print:

- secret value;
- prefix;
- suffix;
- byte content;
- request authorization headers;
- full Gemini request objects if they contain credentials.

Review generic `Debug` logs.

Redact sensitive headers and payload fields.

If using `reqwest`, do not log a fully constructed request if credentials are embedded in headers/query strings.

---

# Part J — Add a focused credential diagnostic command/test

Create a development-safe diagnostic path that verifies lifecycle without exposing the secret.

Possible Rust-only diagnostic:

```text
credential status
credential write succeeded
credential read succeeded
credential identity stable
```

Prefer an automated Rust unit/integration boundary where feasible using an in-memory/fake credential backend.

For the native Keychain path, perform a manual smoke test.

Do not create/delete the user's real Gemini key during automated tests.

If a test credential must exercise the real Keychain, use a clearly separate test account identifier such as:

```text
text-dynamics-diagnostic
```

and remove it afterward.

Avoid unnecessary native Keychain mutation if repository tests can sufficiently cover the abstraction.

---

# Part K — Manual macOS verification

Document a safe manual verification workflow.

macOS provides the `security` CLI.

Examples:

```bash
security find-generic-password \
  -s "text-dynamics" \
  -a "gemini-api-key"
```

This can verify that an entry exists.

Do not print the secret in normal verification instructions.

Avoid `-w` because it outputs the password/secret to stdout.

If the exact service/account differs in the implementation, use the actual stable constants.

Also allow verification through the macOS Passwords/Keychain Access UI if appropriate.

Document:

```text
Save key
→ confirm record exists
→ close app
→ restart tauri dev
→ status still Configured
→ stop dev server
→ restart it
→ status still Configured
→ reboot is not expected to remove record
```

Do not ask the user to paste Keychain output containing secrets into logs/chat.

---

# Part L — SQLite audit

This task also verifies local database persistence.

First determine:

1. whether SQLite is actually installed/enabled;
2. whether the app uses:
   - `tauri-plugin-sql`;
   - direct `sqlx`;
   - `rusqlite`;
   - another SQLite abstraction;
3. the database URI/path configured in code;
4. where that URI resolves on macOS;
5. whether migrations run;
6. whether the DB is created lazily;
7. whether the app currently has any rows/tables;
8. whether multiple dev database files are accidentally being created.

---

# Part M — Why the SQLite file is not expected inside the repository

A desktop application's mutable runtime database should normally live in the operating system's application-data/config directory.

It should **not** normally be:

```text
repo/
  text-dynamics.db
```

Reasons:

- repo source is not runtime state;
- production app cannot rely on its source tree existing;
- packaged application resources may be read-only;
- DB content must survive application upgrades;
- user data must stay outside Git;
- source checkout deletion must not be the normal mechanism for deleting user data;
- different OS users need independent local state.

Therefore the normal architecture is:

```text
repository
  ├─ source code
  ├─ migrations
  └─ schemas/config

macOS application-data directory
  └─ actual runtime SQLite database
```

The repository may contain:

```text
migrations/
001_initial.sql
002_...
```

but not the mutable runtime `.db` file.

---

# Part N — Determine the actual SQLite path at runtime

Do not guess.

Resolve the path through the actual Tauri/plugin API in the installed version.

At startup in development, log something similar to:

```text
[database] backend=sqlite
[database] uri=sqlite:text-dynamics.db
[database] resolved_path=/Users/.../.../text-dynamics.db
[database] open=ok
```

Logging the DB filesystem path is acceptable; it is not a secret.

Do not log database contents.

Important:

Official Tauri documentation has used/referenced application base/config path semantics around the SQL plugin. The current JS API reference describes SQLite paths as relative to the Tauri application base directory, while some plugin documentation/examples have historically described AppConfig semantics.

Therefore:

> use the installed plugin/version and actual resolved runtime path as the authority for this application.

Do not bake a stale hardcoded macOS path into business logic.

---

# Part O — macOS expected location class

The exact directory depends on Tauri/plugin/version/app identifier.

It will normally be in a per-user application support/config/data location under the user's home directory rather than the project directory.

Conceptually expect something in the family of:

```text
~/Library/Application Support/<app-identifier>/...
```

or the application path resolved by the Tauri path/plugin mechanism.

Do not treat this conceptual example as the exact path.

Resolve and log the real path.

---

# Part P — SQLite initialization behavior

Determine whether database creation is lazy.

For example, some SQLite/Tauri APIs create/open the file only when:

```text
Database.load(...)
```

or the first actual connection/query occurs.

Therefore:

```text
SQLite dependency installed
```

does not automatically imply:

```text
database file already exists
```

Verify whether application bootstrap actually opens the DB.

If the application currently does not need persistence yet, do not manufacture a dummy database solely to make a file appear.

If the product already relies on documents/analyses persistence, the DB should be initialized intentionally.

---

# Part Q — SQLite separation of responsibility

SQLite may contain:

```text
documents
analyses
segments
movements
phases
UI/domain metadata
```

SQLite must not contain:

```text
Gemini API key
raw credential-store secret
authentication token intended for OS Keychain
```

Enforce this boundary.

Search existing schema/migrations for accidental secret columns.

If a secret was accidentally stored in SQLite:

1. migrate/remove that storage path;
2. stop writing new secrets there;
3. do not log the existing secret;
4. document that the user may need to rotate the exposed credential if it was ever committed/logged.

Do not overreact if no secret was actually persisted.

---

# Part R — Verify DB consistency across dev restarts

Perform this smoke test if database-backed entities exist:

```text
start app
create/save one harmless test document
record its ID/title
close app
restart tauri dev
confirm document still exists
```

Then verify:

```text
same database resolved_path
```

before and after restart.

If persistence fails, inspect:

- dynamic app identifier;
- changing base path;
- temporary directory use;
- different dev/prod path;
- DB initialization creating a second filename;
- relative path interpreted differently;
- migration failures.

---

# Part S — Runtime diagnostics screen/command

Do not expose secrets, but it is useful for this local developer-oriented app to have a diagnostic object available internally.

Conceptual shape:

```ts
type RuntimeDiagnostics = {
  credential: {
    backend: string
    service: string
    account: string
    status: "configured" | "missing" | "error"
  }
  database: {
    backend: "sqlite"
    uri: string
    resolvedPath: string
    status: "open" | "closed" | "error"
  }
}
```

This does not need a permanent UI if unnecessary.

At minimum, make it available through structured development logs.

Do not include secrets.

---

# Part T — Error handling

Create explicit error categories.

Credential examples:

```text
CredentialNotFound
CredentialAccessDenied
CredentialBackendUnavailable
CredentialWriteFailed
CredentialReadFailed
CredentialDeleteFailed
```

Database examples:

```text
DatabasePathResolutionFailed
DatabaseOpenFailed
MigrationFailed
```

User-facing error messages should be concise.

Logs may contain richer technical context, but never secrets.

Do not use catch-all errors that turn every credential failure into "Missing API Key".

---

# Part U — Development logs

Use the project's existing logging strategy.

Verify that:

```text
logs/
```

captures enough information to diagnose startup.

Expected startup sequence in logs:

```text
application starting
credential backend selected
credential identity
credential lookup result
sqlite configured URI
sqlite resolved path
sqlite connection result
migrations result
application ready
```

Do not leak:

```text
API key
Gemini authorization header
Gemini request URL if secret appears in query parameters
SQLite row contents containing private poem text unless explicitly in debug tooling
```

Poem content should not be dumped to logs by default.

---

# Part V — Restart matrix

Perform and document results for as many of these as practical:

| Action | Key should persist | SQLite should persist |
|---|---:|---:|
| React HMR | yes | yes |
| Vite restart | yes | yes |
| Rust rebuild | yes | yes |
| `tauri dev` restart | yes | yes |
| app close/reopen | yes | yes |
| machine reboot | yes | yes |
| clear browser/webview localStorage | yes | yes |
| delete repository `node_modules` | yes | yes |
| `cargo clean` | yes | yes |
| delete OS Keychain entry | no | yes |
| delete runtime SQLite file | yes | no |

This matrix is an invariant check, not an instruction to destructively test every row.

Do not delete the user's actual database or Keychain entry merely to prove the table.

---

# Part W — Git hygiene

Ensure runtime mutable state is not accidentally tracked.

Check `.gitignore` for sensible local patterns if any repo-local fallback/test DB exists:

```gitignore
*.db
*.db-shm
*.db-wal
*.sqlite
*.sqlite3
```

However, do not blindly ignore migration fixtures or intentionally committed SQLite test fixtures.

The real production/dev runtime database should normally be outside the repository anyway.

Never add API keys or credential dumps to `.gitignore` as a substitute for not writing them there.

---

# Part X — Developer documentation

Create/update a small documentation section, e.g.:

```text
docs/local-storage.md
```

Document:

## Gemini credential

- stored in native OS credential store;
- service name;
- account name;
- never stored in SQLite;
- how status is checked;
- how to safely verify existence on macOS;
- how to remove/replace it;
- dev/prod identity behavior.

## SQLite

- library/plugin in use;
- DB URI;
- actual path resolution strategy;
- how to print/find the current path;
- migration location in repo;
- runtime file intentionally lives outside repo;
- how persistence behaves across restart.

Do not include real secrets or user-specific absolute paths as hardcoded documentation examples.

---

# Part Y — Debugging procedure if key still disappears

If the API key still appears missing after restart, debug in this order.

## Step 1

Inspect logs from save:

```text
credential write started
credential write succeeded
credential read-after-write succeeded
```

If absent, fix save flow.

## Step 2

Record safe identity:

```text
service
account
backend
```

Compare startup vs save.

## Step 3

Use:

```bash
security find-generic-password \
  -s "<service>" \
  -a "<account>"
```

Verify existence only.

Do not use `-w` in automated diagnostic output.

## Step 4

Restart app.

Confirm same:

```text
service
account
backend
```

## Step 5

If Keychain entry exists but Rust says missing:

- inspect error variant;
- inspect backend;
- inspect signing/sandbox state;
- inspect crate feature selection;
- inspect access-control behavior.

## Step 6

If Keychain entry no longer exists:

- inspect whether code deletes it on shutdown/startup;
- search repository for delete/remove credential calls;
- inspect whether a settings reset routine is executed automatically.

## Step 7

If Rust says configured but frontend says missing:

- inspect frontend bootstrap race;
- inspect stale local state;
- inspect async query/cache initialization;
- ensure status fetch resolves before presenting final missing state.

---

# Part Z — Avoid these anti-patterns

## Secret in SQLite

Do not do:

```sql
CREATE TABLE settings (
  gemini_api_key TEXT
);
```

## Secret in frontend storage

Do not do:

```ts
localStorage.setItem("gemini-api-key", apiKey)
```

## Secret in `.env` generated by the app

Do not mutate project `.env` as user credential storage.

## Secret echoed back to UI

Do not provide:

```rust
get_api_key() -> String
```

to the frontend.

Prefer:

```rust
get_api_key_status() -> SafeStatus
```

## Dynamic Keychain identity

Do not do:

```rust
format!("text-dynamics-{}", process::id())
```

## Swallowed errors

Do not do:

```rust
let configured = entry.get_password().is_ok();
```

if all errors thereby become indistinguishable.

Explicitly identify the actual not-found case.

## Database in build output

Do not intentionally place persistent DB state under:

```text
target/
dist/
node_modules/
src-tauri/target/
```

Those are disposable.

## Repository DB as production state

Do not use:

```text
./text-dynamics.db
```

merely because it is easy to see while developing.

Use OS application storage.

---

# Final verification checklist

Before completing the task:

- [ ] inspect actual credential crate and backend;
- [ ] service/account identifiers are stable;
- [ ] save errors are propagated;
- [ ] read-after-write check succeeds;
- [ ] startup reads credential status from Rust;
- [ ] frontend does not own persistent credential state;
- [ ] secret never returns from Rust to frontend after save;
- [ ] secret is absent from logs;
- [ ] secret is absent from SQLite;
- [ ] secret is absent from localStorage/sessionStorage;
- [ ] secret is absent from tracked repo files;
- [ ] restart `tauri dev`;
- [ ] saved key remains configured;
- [ ] verify Keychain record exists safely on macOS;
- [ ] inspect actual SQLite implementation;
- [ ] resolve and log actual runtime SQLite path;
- [ ] confirm runtime DB is not expected in repository;
- [ ] confirm DB opens/migrations run when required;
- [ ] confirm persistence across restart when DB-backed data exists;
- [ ] inspect startup logs for unexplained errors;
- [ ] run frontend quality checks;
- [ ] run Rust formatting/check/clippy using project conventions;
- [ ] update local-storage developer documentation.

Stop when the credential and database persistence boundaries are deterministic and documented.

Do not continue into unrelated feature work.
