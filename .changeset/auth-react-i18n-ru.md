---
"@stapel/auth-react": minor
---

Russian locale as an opt-in `@stapel/auth-react/i18n/ru` subpath (i18n-shipping
wave 1 — the reference pattern for every pair).

- `errors.ru.gen.ts` — generated per-locale error bundle: `gen-errors.mjs` now
  reads the backend's locale catalogs (`translations/errors.<lang>.json` beside
  the canonical `docs/errors.json`; auto-discovered, or pinned via
  `ERRORS_LOCALES` / `ERRORS_CATALOG_DIR`). The generator fails on a missing
  registry code or a broken `{param}` slot, and `pnpm gen:errors:check` remains
  the drift gate. Existing en outputs are byte-identical.
- `@stapel/auth-react/i18n/ru` — `authI18nBundleRu` (generated backend ru +
  hand-written ru UI copy) and `registerAuthI18nRu(engine)`, which registers
  the en floor UNDER the ru texts so a missing key degrades to English, never
  to a raw key. Host bundles registered after the pair's win (merge-priority
  convention, now documented on `registerAuthI18n`).
- Tree-shake purity is gated twice: the main-entry size-limit budget is
  unchanged (10.63 kB — the ru locale is not in its graph; the ru subpath is
  its own 5.62 kB chunk, budget 7 kB) and `test/i18nRu.test.ts` walks the
  compiled `dist/index.js` module graph asserting the ru modules never appear.
