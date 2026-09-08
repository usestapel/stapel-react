---
"@stapel/listings-react": minor
---

The seventeen refusals this pair used to write are the module's own words now

`stapel-listings` 0.22.8 ships `translations/errors.ru.json` and
`errors.es.json` — the first release in which the seventeen error codes it owns
have any language but English. Until today the pair stood in for that: `gen:errors`
pointed `ERRORS_CATALOG_DIR` at **stapel-core's** catalogue (a module's own slot
filled by a stranger), listed `stapel_listings` in `ERRORS_LOCALE_EXEMPT_OWNERS`,
and `src/i18n/ru.ts` / `es.ts` carried seventeen hand-written sentences beside the
generated bundle that did not.

The pin moves to v0.22.8, the exemption drops, and those seventeen hand-written
lines are **deleted** rather than kept beside the upstream ones. One string, one
source: with both present the same key resolves twice, nothing in either file can
say which one a screen showed, and the two drift the next time either side is
reworded. `listingsErrorBundleRu` / `listingsErrorBundleEs` (the `./i18n/ru` and
`./i18n/es` exports) therefore grow by those seventeen keys, and stop being
`Partial` for them.

Thirteen of the wordings change as a result — upstream is terser than what stood
in for it (`error.400.category_required` was "you need to pick a category" and is
now "a category is required"; `error.409.listing_cannot_delete_active` now names
the archive, which is the move the server actually wants). Four were already
byte-identical.

**One override survives, and it is deliberate.** `error.409.invalid_listing_transition`
interpolates `params.from_status` — the WIRE value, `'draft'` / `'archived'` — into
translated prose, which is the sentence a live cabinet once showed a seller while
the row's own status tag two lines above said "Draft" in their language. The pair
keeps its placeholder-free sentence, commented where it sits, and `test/i18n.test.ts`
now goes red if upstream drops the placeholder (so the override gets deleted rather
than quietly duplicating the catalogue). **Upstream ask for stapel-listings**: drop
`{from_status}` from the ru and es texts for that code.

The 13 `stapel_attributes` codes stay exempt and stay out. stapel-attributes 0.9.3
ships a catalogue of its own now, but merging it *here* would give one refusal two
sentences from two packages — that catalogue's consumer is `@stapel/attributes-react`,
which owns those keys.

Also in the 0.22.4 → 0.22.8 span: `RefSelectDao` gains `prefix` and `postfix`
(optional, nullable strings) in the generated client, matching `StringDao`/`IntDao`/
`FloatDao`. `docs/errors.json` and `docs/flows.json` are byte-identical across it.

`i18n/ru` measures 5.52 KB and `i18n/es` 4.2 KB after the swap; both budgets
(6 KB / 4.5 KB) unchanged.
