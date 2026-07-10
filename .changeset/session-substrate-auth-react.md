---
"@stapel/auth-react": minor
---

`createAuthSession` now builds on `@stapel/core`'s `createSessionManager`
(frontend-core-architecture-v2 §43): auth keeps owning the tokens and the
refresh HTTP call; the core SessionManager owns the lifecycle — single-flight
refresh, status, events, the logout-hook registry, and the per-session
encryption key.

- New: `AuthSession.getSessionManager()` — other modules register logout
  hooks / read three-state status (guest sessions map from
  `user.is_anonymous` → `"anonymous"`) without depending on auth-react.
- New: `createAuthRuntime({ onSessionLost })` / `createAuthSession({
  onSessionLost })` — the host's involuntary-loss policy (login redirect vs
  anonymous auto-login, resolved from the host's discovery config). Fires
  only for `revoked`/`expired`, never for explicit `logout()`; `onTeardown`
  keeps firing for all three.
- New: `createAuthSession({ refreshApi })` — the token-refresh call now rides
  a dedicated client WITHOUT the `onAuthRefresh` seam (wired automatically by
  `createAuthRuntime`), replacing the old in-module recursion flag.
- `logout()` now fans out through the core logout-hook registry; auth-react's
  own state/persisted-storage cleanup is registered as a hook like everyone
  else's, and hooks also run on involuntary session loss.
- Removed duplicate state: single-flight/dedup bookkeeping now lives only in
  core. Public API and existing behavior (teardown reasons, cookie mode,
  persistence shape) are unchanged.
