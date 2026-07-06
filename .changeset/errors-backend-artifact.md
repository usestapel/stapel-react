---
"@stapel/auth-react": minor
---

`gen:errors` now consumes the backend's canonical `errors.json` artifact
instead of parsing Python sources (frontend-core-architecture §2.5; backend
task `error-remediation`).

**Driver migration.** `scripts/gen-errors.mjs` reads
`stapel-auth/docs/errors.json` — a byte-stable, code-sorted array of
`{ code, status, params, remediation, en }` emitted by the backend alongside
`schema.json`/`flows.json` (path override: `AUTH_ERRORS_JSON`). The three
sibling-checkout Python parse (auth `errors.py` + stapel-core verification
`grants.py`/`errors.py`) is gone, along with the ported remediation/en
heuristics: the backend now declares remediation on the registry, so the
`PROVISIONAL` note is dropped and the map is consumed verbatim. The driver
validates every `remediation` against the finite vocabulary.

**Superset surface.** The catalog grows from 75 to **114 keys** — the backend
set adds the captcha, network, common, and field families. Every new key ships
its en fallback, so `authErrorBundleEn` stays total by construction and the
`errorsBundle` coverage test is green. `manifest.errors` and the generated
`AUTH_ERRORS`/`AUTH_ERROR_CODES` reflect the full set.

**llms.txt** trims the Errors section to a digest (remediation histogram +
param-bearing keys) pointing at `manifest.json §errors` for the full catalog,
keeping the pair's slice within its §2.4 token budget.

CI drops the stapel-core verification-registry checkout (it existed only for the
old parse); only the stapel-auth artifact checkout remains.
