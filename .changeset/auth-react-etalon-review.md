---
"@stapel/auth-react": patch
---

Etalon re-review fixes (post G1–G8 pair review):

- **`manifest.backend.contract`** — the manifest now states the backend semver
  range the surface was generated against (`>=0.5 <0.6`, derived from the
  stapel-auth pyproject at gen time; `MANIFEST_BACKEND_PYPROJECT` override).
  Drift becomes addressable per frontend-core-architecture §2.4/§3.4.2: a
  backend minor bump reddens the manifest drift gate exactly like a schema
  change. llms.txt header carries the same range.
- **Demo harness: unit-correct spacing shorthands.** Size tokens are unitless
  numbers; React auto-appends `px` only to single numeric style values, so the
  two-value `padding` shorthands built by interpolation produced invalid CSS
  ("8 16") that browsers silently dropped. The canonical demos now spell the
  unit (`` `${spacing["2"]}px ${spacing["4"]}px` ``) — demos are the snippets
  agents copy, so the broken pattern must not replicate.
