---
"@stapel/eslint-plugin": patch
---

`stapel/no-adhoc-401`: the carve-out now covers `auth-react`'s
`model/session.ts` alongside core's `client.ts`/`session.ts`.

That file is the authenticating module's `doRefresh` — the other half of the
same seam, not a bypass of it. Somebody has to read the status code the
refresh endpoint answered with and decide what it means (revoked vs expired
vs "the backend simply isn't there") before handing `SessionManager` an
outcome, and this is the one file that does it. Forcing the classification
out of there would push it into call sites, which is exactly what this rule
exists to prevent.
