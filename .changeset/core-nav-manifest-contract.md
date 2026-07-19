---
"@stapel/core": minor
---

Add the shared navigation-manifest contract types (`NavEntry`, `NavRoute`, `NavComponentRef`, `NavPlacement`, `NavPlacementLevel`, `PackageNavManifest`), exported from the package root. Ф1 lib-side foundation for the scripted-fullstack navigation contract (owner directive: one scripted command with no LLM produces a working navigated fullstack): a pair declares its screens' nav entries in `src/nav/manifest.ts` against these types, `scripts/gen-nav-manifest.mjs` validates and emits `nav-manifest.json`, and `@stapel/shell-react`'s `resolveNav` (new package, separate changeset) turns installed manifests + a project's overrides into the tree a shell renders. Pure data types — no React, no I/O — so the same contract works at scaffold codegen time and at runtime.
