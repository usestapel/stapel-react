---
"@stapel/core": minor
---

§17 arch-contract-pipeline Wave 0 — retire `@stapel/core`'s generated schema
surface and the monolith as a contract source.

`@stapel/core` no longer exports the generated `paths` / `components` /
`operations` types (and no longer ships `src/generated/schema.ts`). Under the
per-module contract pipeline every `@stapel/<module>-react` pair already
generates its OWN self-contained wire types from its backend's committed
`docs/schema.json`; nothing consumed core's aggregate export (grep-confirmed),
and stapel-core has no DRF endpoints of its own from which a meaningful core
slice could be emitted — the shared `User` / `StapelError` / `TokenPairResponse`
schemas only materialise via a module's endpoints. The hand-authored runtime
error contract (`StapelApiError`, `StapelErrorEnvelope`) is unchanged and stays
the public error surface.

This removed core as the last reader of the monolith aggregate: `gen:api` now
requires per-module `API_SCHEMA` + `API_OUT` (no monolith default), and the
monolith checkout is dropped from CI. A minor bump because generated type
exports are removed from the public API, even though no workspace consumer
imported them.
