# Text Dynamics — Local Storage & Credential Persistence

This document explains the storage architecture, credential security model, SQLite database location, and manual verification procedures for Text Dynamics on macOS (and desktop platforms).

---

## 1. Gemini API Key (OS Credential Store)

### Storage Boundary & Security Guarantees

The Gemini API key is stored exclusively within the native operating system secure credential store:
- **macOS**: Apple Keychain via `security-framework` (in the `keyring` crate v3 with `apple-native` feature).
- **Windows**: Windows Credential Manager (`windows-native`).
- **Linux**: Secret Service API (`sync-secret-service`, `crypto-rust`).

**Key Security Invariants**:
1. The API key is **never** written to SQLite, `localStorage`, `sessionStorage`, cookies, `.env`, or configuration files.
2. The API key is **never logged** (structured logs strictly redact API keys, auth headers, and query parameters).
3. The API key is **never returned** from Rust to the frontend after saving. The frontend queries only safe metadata status (`ApiKeyStatus`: `"configured" | "missing" | "error"`).
4. Gemini HTTPS requests originate exclusively from the native Rust backend. The credential is read in-memory in Rust at request time and dropped immediately.

### Identity Identifiers

- **Primary Service Name**: `text-dynamics`
- **Primary Account Name**: `gemini-api-key`
- **Legacy Fallback / Migration**: If no entry is found under `text-dynamics`, the app checks for legacy records under `dev.commodore64.text-dynamics` / `gemini_api_key` and automatically migrates them to the primary identifier.

### Lifecycle & Verification

1. **Save Flow with Read-After-Write Verification**:
   - The user inputs their key into the Settings dialog.
   - The key is sent via IPC command `set_api_key`.
   - Rust trims and validates non-emptiness.
   - Rust writes the secret to the native Keychain entry (`text-dynamics` / `gemini-api-key`).
   - Rust immediately performs a **read-after-write verification** to confirm that the key can be retrieved and matches byte-for-byte, then drops the retrieved copy.
   - A success confirmation is returned to the frontend, which immediately wipes the input text field.

2. **Status Discrimination**:
   - `configured`: Valid non-empty credential exists in the Keychain.
   - `missing`: Native store returned `keyring::Error::NoEntry` (no password saved).
   - `error`: Native store returned an access denial, backend failure, or decoding error. This distinguishes Keychain permission/sandbox issues from a missing key.

3. **Safe Manual Verification on macOS**:
   Verify that a record exists in the macOS Keychain without exposing the secret on the terminal:
   ```bash
   security find-generic-password -s "text-dynamics" -a "gemini-api-key"
   ```
   *(Note: Avoid using `-w` to prevent printing the plaintext secret).*

4. **Deletion**:
   Activating the trash icon in Settings calls `delete_api_key`, which deletes both primary and legacy entries from the OS Keychain.

---

## 2. Local SQLite Persistence

### Architecture & Responsibility

Text Dynamics uses an embedded SQLite database managed via `rusqlite` (bundled statically in Rust). The frontend does not execute raw SQL or manage database connections.

**Stored Data**:
- **`documents`**: Document ID, title, full text content, creation/update timestamps.
- **`analyses`**: Immutable canonical analysis JSON results, document link, model ID, prompt version.
- **`analysis_overrides`**: User edits (dragged metric values, movement kind overrides, named group clusters) saved independently from the canonical AI base.
- **`settings`**: Non-sensitive application configuration (active Gemini model identifier, custom instructions, theme).
- **`schema_migrations`**: Executed migration versions and timestamps.

### Database Location at Runtime

The SQLite database file resides in the operating system's standard application data directory, **strictly outside the Git repository**:

- **macOS**:
  ```text
  ~/Library/Application Support/dev.commodore64.text-dynamics/text_dynamics.db
  ```
  *(Resolved dynamically via Tauri `app.path().app_data_dir()`)*.

- **Why it is not in the Git repository**:
  - Mutable user data must survive source code updates, git branch switching, and rebuilds.
  - User texts and analyses must not be tracked or committed to version control.
  - Packaged desktop application bundles require writable paths outside the application bundle.

### Safe Startup Diagnostics in Logs

Upon application initialization, Rust emits safe structured startup entries to `logs/dev.latest.log`:

```text
[database] backend=sqlite uri=sqlite:text_dynamics.db resolved_path=/Users/.../Library/Application Support/dev.commodore64.text-dynamics/text_dynamics.db open=ok
[credential] backend=macos-keychain (security-framework) service=text-dynamics account=gemini-api-key status=Configured
```

### Durability & Persistence Matrix

| Scenario | API Key Persisted | SQLite Data Persisted |
| :--- | :---: | :---: |
| React HMR (Hot Module Replacement) | Yes | Yes |
| Vite dev server restart | Yes | Yes |
| Rust recompilation (`cargo build`) | Yes | Yes |
| Tauri dev restart (`bun run dev:logged`) | Yes | Yes |
| Application close and reopen | Yes | Yes |
| System reboot | Yes | Yes |
| Clear webview `localStorage` | Yes | Yes |
| `cargo clean` or delete `node_modules` | Yes | Yes |
| Remove OS Keychain record | No | Yes |
| Delete SQLite file in `Application Support` | Yes | No |
