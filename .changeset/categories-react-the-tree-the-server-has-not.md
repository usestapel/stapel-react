---
"@stapel/categories-react": minor
---

New pair: `@stapel/categories-react` — the catalogue, assembled and kept fresh
by the client because the backend does none of those three things.

`stapel-categories` has no tree endpoint, no slug lookup, and no resolved
labels. `GET /categories/` returns flat rows ordered by `revision`, with
django-treenode's ancestry as **comma-joined pk strings**; `lookup_field` is
never overridden and the list has no slug filter, so `/c/<slug>` cannot be
asked of the server at all; and `name` arrives as `category.electronics`
because the module's `DISPLAY_TRANSLATOR` seam is called from `__str__` and the
admin label cache — never from a serializer. Each of those is now handled once,
here, instead of being rediscovered per host.

- **The tree.** `buildCategoryTree` assembles flat rows, orders siblings by
  `tn_priority` descending with a deterministic tie-break, and drops both
  soft-deleted rows and **inactive** ones — `active` is filtered server-side
  only by `/carousel/`. A row whose parent is missing becomes a root instead of
  vanishing with its subtree.
- **The delta sync.** The module's documented protocol (full GET → store
  `revisions.global_max` → `?min_revision=`) into an app-scoped
  `createRepository`, so a second storefront page costs one small delta instead
  of the whole catalogue. Two rules the documentation omits are implemented
  anyway: `revisions.deleted_ids` is the authoritative tombstone channel
  (the `deleted: true` rows are paginated and a short walk misses them), and a
  multi-page walk pins `max_revision` or a concurrent write shifts its page
  boundaries. A walk stopped by its page budget reports `truncated` and rewinds
  its cursor rather than recording progress it did not make.
- **Names are keys, and the pair says so.** `categoryLabel` / `featureLabel` /
  `featureOptionsAreKeys` report `key` vs `literal` from `translatable`,
  `translate` and `config.translatable_options`. Resolution goes through the
  HOST's i18n engine and this package ships no category names — a catalogue is
  a deployment's content. An unresolved key renders as the key, deliberately.
- **The feature schema** is handed to `@stapel/attributes-react` unmodified:
  `CategoryFeature` *is* its `FeatureDef`, so the same rows feed
  `<FeatureFields>`, `unsupportedTypeGate` and the search pair's facet
  captions. `config` arrives verbatim, so defaults stay where they are owned.

Surface: `createCategoriesRuntime`/`CategoriesProvider`, `useCategoryCatalog`
plus four direct reads, the pure `catalog/` layer, five headless bags, and an
opt-in `./default` antd skin with `CatalogPage` (`/c`) and `CategoryPage`
(`/c/:slug`, with a `renderListings` slot for the search half). en/ru/es.

Not in scope: the catalogue admin. Create/update/delete, the bulk endpoints,
`undelete`, `convert-type` and the four feature-editor operations are all
`IsStaffUser`; `POST {id}/validate-dto/` is a write in DRF's eyes and 403s a
visitor; `GET /translation-keys/` is `IsServiceRequest`. `manifest.json` still
lists the whole contract.
