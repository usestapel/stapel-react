---
"@stapel/core": patch
"@stapel/auth-react": patch
---

Fixes a live-incident race (owner-diagnosed finisher, миттудей): `AuthSession.logout()` used to await the server-side revoke call BEFORE any local teardown. In the window between the server honoring that revoke and this session getting back around to tearing itself down, a parallel authenticated request (e.g. a Navbar still holding a stale `useWorkspaces` query) would 401, retry its own refresh against the now-revoked token, fail, and race a `sessionLost('expired'/'revoked')` teardown in ahead of the explicit logout — rendering a "session expired" banner on a logout the user asked for themselves.

Two changes, combined:

- `@stapel/core`'s `SessionManager.logout()` now holds a `loggingOut` guard for its full duration (set synchronously before its first `await`). `sessionLost()` is a no-op while that guard is up — in addition to its existing idempotent no-op once already `"unauthenticated"` — and now reports which case applies via its return value (`Promise<boolean>`: `true` only if it actually performed a teardown).
- `@stapel/auth-react`'s `AuthSession.logout()` now runs the local teardown (`sessionManager.logout()` + `onTeardown('logout')`) FIRST — instant, no network dependency — and treats the server revoke as best-effort afterward. `settleRefreshFailure` only calls `onTeardown(reason)` when `sessionLost()` reports it actually tore the session down, so a racing refresh failure during an in-flight logout never fires a contradictory `onTeardown('expired'|'revoked')`.
