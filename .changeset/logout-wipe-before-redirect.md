---
"@stapel/auth-react": patch
---

The persisted user is really gone before a teardown reports done.

Owner-reported live incident (2026-07-26): opening the app produced a
strobe of redirects between `/app` and `/sign-in` — 222 requests in a loop
before it happened to settle.

The trigger was a server in a legitimate but inconsistent state: `GET /me/`
answered 200 off a still-live access cookie while `GET /token/refresh/`
answered 401 off a dead refresh cookie. A client has to survive that. What
turned it into a redirect storm was here: the logout hook started an async
wipe of the persisted user snapshot and returned `undefined`. Since
`runLogoutHooks` awaits its hooks, the session manager considered teardown
finished while the delete was still in flight; the host's `onSessionLost`
policy then ran a hard `window.location.href` redirect, and the page died
before IndexedDB committed. The reloaded page restored the very user it had
just been told to forget, the sign-in screen saw a session and bounced back
to `/app`, whose refresh 401'd again — and the loop only ended when a wipe
happened to win a race against a navigation. "It flickered and then settled"
is exactly what that looks like from outside.

The hook returns its promise now, so the wipe is part of the teardown rather
than a race against it.
