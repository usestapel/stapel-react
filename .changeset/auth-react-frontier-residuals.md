---
"@stapel/auth-react": patch
---

Frontier adversarial-review residuals (verification passkey auto-drive + cookie-mode session):

- **Passkey auto-drive success path (stale credential).** The identity guard that
  keeps a late-rejecting native prompt from resurrecting a dead challenge now
  also guards the SUCCESS path: a native prompt resolving after the challenge
  moved on (cancel + a NEW challenge reaching `awaitingPasskey`) no longer
  submits the stale credential against the newer challenge's `session_key`.
- **Cookie mode stops persisting JWTs.** `createAuthSession({ cookieMode: true })`
  no longer mirrors the token pair into JS-readable storage (IndexedDB/
  localStorage) — doing so reopened exactly the XSS-theft hole HTTP-only
  cookies exist to close. Only the user snapshot is persisted (optimistic user
  cache); `restore()` now treats a stored user as an authenticated session in
  cookie mode, and a dead cookie pair tears down via the refresh seam on the
  first request.
