---
"@stapel/geo-react": minor
---

Spanish, and the theme root gets drawn.

**`./i18n/es`.** The pair shipped a Russian bundle and no Spanish one, so a
Spanish host rendered English copy in the middle of its own UI — invisible in
every test, because every test runs in one locale. `src/i18n/es.ts` mirrors
`ru.ts` key for key: the generated `geoErrorBundleEs` spread first, the eight
`stapel_geo`-owned codes authored beside it (the module ships no
`translations/`), then the 30 UI keys. `test/i18nEs.test.tsx` pins coverage,
placeholder parity against the English bundle, and a real render under `es`.

**The default-skin gate goes 3/4 → 4/4.** `GeoSkinTheme` was listed in the
picker demo's `covers` but never imported from `src/default` there, so nothing
rendered it under its own name — which is exactly the hole the gate checks for.
It now has a `dark` variant that mounts it explicitly at phone width. That is
not a formality: the wrapper exists because a skin with no internal theme
provider once inherited a host bridge serving light-mode values inside a dark
document and rendered text on background at 1.00:1, and pinning the mode is the
one use its `mode` prop is for.
