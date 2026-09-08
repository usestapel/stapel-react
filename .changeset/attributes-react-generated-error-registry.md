---
"@stapel/attributes-react": minor
---

The engine's thirteen refusals come from upstream now, in every language.

stapel-attributes 0.9.4 emits `docs/errors.json` — the registry artifact every
sibling library already had and this L1 library did not, because it has no
Django app for autodiscovery to walk and therefore had no emission harness. It
has one now, so `pnpm gen:errors` is wired for this pair and
`src/i18n/generated/` exists here for the first time.

What that deletes: the **thirteen hand-authored ru and es lines** in
`src/i18n/{ru,es}.ts`, and the thirteen retyped English strings in
`src/i18n/keys.ts`. `ATTRIBUTES_ERROR_BUNDLE_EN` is now a re-export of the
generated en bundle — the same thirteen keys with the same `{feature}` /
`{min_length}` / `{max_length}` slots, plus the forty-two cross-cutting
`stapel_core` codes a host of this library can also raise. `pnpm
gen:errors:check` owns all of it: a reworded refusal upstream is a red diff,
not a silent divergence.

The ru/es wording changes accordingly — it is upstream's now, not this pair's.
`attributesErrorBundleRu` / `attributesErrorBundleEs` are exported from the
`./i18n/ru` and `./i18n/es` subpaths for a host that wants the error slice
alone.

These thirteen belong to THIS pair and to no other: `@stapel/listings-react`
and `@stapel/categories-react` both keep `stapel_attributes` in
`ERRORS_LOCALE_EXEMPT_OWNERS`, which matters more than it reads —
`registerListingsI18nRu` calls `registerAttributesI18nRu` and registers its own
bundle after it, so a duplicate over there would silently win.

Size budgets move by measurement, not by allowance: `index` 9.25 → 10 KB
(measured 9.72) and `default` 19.25 → 20.25 KB (measured 19.9), which is the
generated en registry landing in the main entry. The ru and es bundles came in
UNDER their existing 3 KB lines (2.52 and 1.87).
