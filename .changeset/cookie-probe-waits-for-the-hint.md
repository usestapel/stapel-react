---
"@stapel/auth-react": patch
---

An anonymous visit costs zero auth requests in cookie mode.

`bootstrapProbe: "auto"` consulted the `stapel_auth_hint` cookie only in
bearer mode; cookie mode probed unconditionally. So a public storefront in
cookie mode — the default — opened every cold `restore()` with a
`/token/refresh/` call against an empty cookie jar: two 401s on every
anonymous visit and every crawl, measured live on southgate.test, looking for a
session the hint cookie already said was not there. On a classified where
80–95% of traffic is exactly that visit, it was the first thing every visitor
and every bot paid for.

The gate is now one rule for both modes: `"auto"` probes when the hint cookie
is present, `"always"` probes regardless, `"off"` never probes and still warns
once. `stapel-auth` sets the hint alongside every httponly pair it mints, so a
signed-in visitor is unaffected — the QR/magic-link/SSO cold-load discovery
this probe exists for keeps working exactly as before.

A LIVE 401 is untouched: `doRefresh`'s early-out stays bearer-only, so a
cookie-mode request that meets a 401 mid-session refreshes as it always did.
Only the cold bootstrap SEARCH — the one with no evidence a session ever
existed — is gated.
