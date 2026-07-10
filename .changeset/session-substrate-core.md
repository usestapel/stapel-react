---
"@stapel/core": minor
---

Session substrate & user-data hygiene (frontend-core-architecture-v2 §43).

- **`createSessionManager`** (§43.1) — the one owner of session lifecycle:
  three-state status (`authenticated | anonymous | unauthenticated`),
  **single-flight refresh** (N concurrent 401s share ONE `doRefresh()` call),
  typed events (`session:refreshed` / `session:lost` / `session:logout`), a
  host-injected `onSessionLost` policy (login redirect vs anonymous
  auto-login — resolved from the host's discovery config, never hardcoded),
  and the per-session WebCrypto key repositories encrypt with.
- **Logout-hook registry** (§43.3) — `registerLogoutHook(fn)`, run on BOTH
  explicit `logout()` and involuntary session loss; one throwing hook never
  blocks the others.
- **`createRepository(namespace, { storage, scope, encrypted })`** (§43.4) —
  the ONE sanctioned client-side store. `scope: "user"` auto-registers
  wipe-at-logout with NO opt-out and is encrypted by default (AES-GCM,
  per-session in-memory key; logout drops the key first, synchronously, so a
  crash mid-wipe still leaves ciphertext unreadable — §43.5). `scope: "app"`
  (theme, locale) survives logout and never uses the session key.
  Contract-tested: after `logout()` user-scoped data is physically absent
  from both stores and the key is dropped. Honest boundary (in the README,
  verbatim from the governing doc): frontend encryption does NOT defend
  against XSS with code execution — it defends data at rest.
- **`createModuleRuntime`** now registers a logout hook on the active
  `SessionManager` — the pair's `onLogout` option, or a no-op default
  (§43.7: every standard pair mechanically has a cleanup call site).
- `createStapelClient`'s 401 path is unchanged in behavior and now documented
  as the ONE legal home of 401 handling (§43.2): `onAuthRefresh` (wire it to
  `SessionManager.refresh()`) → retry once → still 401 → session lost.
