---
"@stapel/categories-react": minor
---

The nine refusals this pair used to write are the module's own words now

`stapel-categories` 0.21.5 ships `translations/errors.ru.json` and
`errors.es.json` — the first release in which the nine error codes it owns have
any language but English. Until today the pair stood in for that: `gen:errors`
pointed `ERRORS_CATALOG_DIR` at **stapel-core's** catalogue, listed
`stapel_categories` in `ERRORS_LOCALE_EXEMPT_OWNERS`, and `src/i18n/ru.ts` /
`es.ts` carried nine hand-written sentences beside the generated bundle that did
not.

The pin moves to v0.21.5, the exemption drops, and those nine hand-written lines
are **deleted** rather than kept beside the upstream ones. One string, one source:
with both present the same key resolves twice and the two drift the next time
either side is reworded. `categoriesErrorBundleRu` / `categoriesErrorBundleEs`
(the `./i18n/ru` and `./i18n/es` exports) therefore grow by those nine keys, and
stop being `Partial` for them.

All nine wordings move, and every difference is punctuation or a synonym: upstream
writes no trailing full stop, says "a request TO the feature editor" where the pair
said "a feature editor request", and in `es` leaves `{slug}` unquoted where the pair
wrote «{slug}». Nothing here was worth an override, so this pair now keeps none —
`test/i18n.test.ts` reads `src/i18n/{ru,es}.ts` as text and fails if an `error.*`
line comes back. **Upstream ask for stapel-categories**: quote the slug in the `es`
texts for `categories_duplicate_slug` and `categories_slug_not_found`, so `es` reads
like `ru` and like the module's other messages.

The 13 `stapel_attributes` codes stay exempt and stay out — that catalogue's
consumer is `@stapel/attributes-react`, which owns those keys.

Also in the 0.21.1 → 0.21.5 span: `GET /categories/by-slug/{slug}/` documents a
`301` to the current slug for a slug a category used to carry, which the generated
client picks up; a category `slug` widens from 100 to 255 characters, which
openapi-typescript does not emit. `docs/errors.json` and `docs/flows.json` are
byte-identical across it.
