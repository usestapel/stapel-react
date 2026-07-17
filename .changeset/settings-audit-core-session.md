---
"@stapel/core": minor
---

Session-lifecycle fix for a live incident (2026-07-17): a query hook with no
manual `enabled` gate could race a session still bootstrapping — right after
an external event set fresh auth state this JS runtime hadn't caught up to
yet (e.g. a QR `session_share` scan setting httponly cookies via a plain
redirect) — and read a live session as "expired".

- **`SessionStatus` gains `"initializing"`** — a 4th, DISTINCT state from
  `"unauthenticated"`. `"unauthenticated"` means "checked, no session";
  `"initializing"` means "haven't checked yet". `createSessionManager` is now
  born `"initializing"` by default (previously `"unauthenticated"`, which
  collapsed the two).
- **`SessionManager.isReady()` / `.whenReady()`** — the framework-level
  ready-gate: `false`/pending while `"initializing"`, resolves the instant the
  session settles into any of the other three states.
- **`SessionManager.markUnauthenticated()`** — settle `"initializing"` into a
  confirmed "never had a session" with NO teardown side effects (no logout
  hooks, no `onSessionLost`) — distinct from `sessionLost()`, which assumes an
  existing session is ending.
- **`useSessionReady(manager)` / `useActiveSessionReady()`** (new hooks) — a
  pair's query hook gates on `useActiveSessionReady()` (reads
  `getActiveSessionManager()`, zero prop plumbing) instead of hand-rolling an
  `enabled` check; `true` (never blocks) when no module has created a session
  manager at all.
- **`createStapelClient`'s `onAuthRefresh` retry fix**: resolving `""` (empty
  string — a successful refresh with no bearer token to attach, i.e. cookie
  mode) used to be indistinguishable from `null` (refresh FAILED) because the
  retry condition checked `refreshed.length > 0` instead of `refreshed !=
  null`. Every cookie-mode 401 retry threw the original error instead of ever
  re-issuing the request against the now-refreshed cookie jar. Fixed; see the
  `onAuthRefresh` doc comment for the full three-outcome contract.

`@stapel/auth-react`'s `createAuthSession`/`createAuthRuntime` are the first
consumer (see that package's own changeset) — a bootstrap probe on
`restore()` plus the corrected retry contract together close the incident.
