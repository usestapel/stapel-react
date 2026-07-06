---
"@stapel/billing-react": minor
---

Russian locale as an opt-in `@stapel/billing-react/i18n/ru` subpath
(i18n-shipping wave 2, following the auth-react etalon — wave 1).

- `errors.ru.gen.ts` — generated per-locale error bundle, auto-discovered by
  the shared `gen-errors.mjs` driver from stapel-billing's
  `translations/errors.ru.json` catalog. `pnpm gen:errors:check` remains the
  drift gate; existing en outputs are byte-identical.
- `@stapel/billing-react/i18n/ru` — `billingI18nBundleRu` (generated backend
  ru + hand-written ru UI copy) and `registerBillingI18nRu(engine)`, which
  registers the en floor UNDER the ru texts so a missing key degrades to
  English, never to a raw key. Host bundles registered after the pair's win
  (merge-priority convention, now documented on `registerBillingI18n`).
- Tree-shake purity is gated twice: the main-entry size-limit budget is
  unchanged (the ru locale is not in its graph; the ru subpath is its own
  chunk with its own budget) and `test/i18nRu.test.ts` walks the compiled
  `dist/index.js` module graph asserting the ru modules never appear.
