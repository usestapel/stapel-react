---
"@stapel/auth-react": minor
"@stapel/notifications-react": minor
"@stapel/profiles-react": minor
"@stapel/billing-react": minor
"@stapel/workspaces-react": minor
---

§17 arch-contract-pipeline Wave 2 + Wave 3 — the five original pairs are now
self-contained per-module contracts, aligned to their backend minor.

**Wave 2 (contract isolation).** Each pair generates its typed surface from its
backend module's OWN committed `docs/{schema,flows}.json` (byte-identical to the
former monolith slice) instead of the unified monolith aggregate:

- `gen:api` emits a package-LOCAL `src/api/generated/schema.ts` per pair (via the
  `API_SCHEMA`/`API_OUT` knobs — the calendar/recordings §17-native shape);
  `api/types.ts` aliases `components` from `./generated/schema.js`, no longer from
  `@stapel/core`. `@stapel/core` stays a RUNTIME peer (client / react-query),
  not the type source.
- `gen:flows` reads `../stapel-<mod>/docs/flows.json`; `gen:manifest` reads the
  per-module `docs/schema.json`. Public types are unchanged — the repoint is a
  zero-diff source-swap (byte-identity proven), so no consumer breaks.

**Wave 3 (version scheme B).** Each pair's minor now tracks its backend minor:
`auth-react → 0.5.0` (stapel-auth 0.5.x), `notifications-react → 0.3.0`,
`profiles-react → 0.3.0`, `billing-react → 0.4.0`, `workspaces-react → 0.3.0`.
`manifest.backend.contract` records the one-minor compatibility window
(`>=0.5 <0.6` etc.), auto-derived from the backend `pyproject.toml`.
