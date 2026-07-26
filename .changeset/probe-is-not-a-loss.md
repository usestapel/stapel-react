---
"@stapel/auth-react": patch
---

A negative bootstrap probe is no longer reported as a session loss.

Second and deeper cause of the redirect strobe (owner-reported, 2026-07-26).
`restore()` runs a bootstrap probe when it finds none of its own persisted
state — a SEARCH for a session, not a check of one. Its 401 was settled
through the same path a live 401 uses, so if anything had marked the manager
authenticated in the meantime, the probe's negative answer tore that session
down and fired the host's redirect policy.

That race is ordinary, not exotic: a host with its own auth context calling
`GET /me/` on mount will win it routinely. Against a server holding a live
access cookie and a dead refresh cookie — a state it is entitled to be in —
/me answered 200 while the probe answered 401, and the two verdicts chased
each other: teardown, hard redirect to /sign-in, reload, /me 200 again,
sign-in bounces to /app, probe 401 again. 222 requests before it happened to
settle.

Finding nothing is not losing something. A probe now settles quietly and
never tears down; a live 401 still does, unchanged.
