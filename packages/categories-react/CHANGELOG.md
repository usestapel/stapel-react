# @stapel/categories-react

## 0.3.1

### Patch Changes

- The floor states what the imports already require: `@stapel/core >=0.16.0`

  `LinkComponent` first shipped in `@stapel/core@0.16.0`, and this package has
  imported it since. The declared peer floor still said `>=0.15.0`, which npm
  would have honoured — installing a core with no such export, and failing the
  host's typecheck on a symbol this package's own `.d.ts` references. The
  monorepo cannot see it: in here every package builds against the workspace
  peer, never against its own floor.

## 0.3.0

### Minor Changes

- f6ee27a: `linkComponent`: category chrome that does not reload the page

  Breadcrumbs, the tree and the carousel are nothing but links, and every one of
  them rendered a plain `<a href>`. Inside a router app that is a full page load
  per click — the whole application thrown away and rebuilt to move between two
  categories whose rows are already in memory, which is the entire point of this
  pair's delta-synced, app-scoped catalogue. The storefront could not use the
  chrome at all and named it a gap (Wave D, G-4).

  The pair still carries no router. It takes core's `LinkComponent` — a component
  over a plain `href` — and every skin spells the prop the same way:

  ```tsx
  const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
    <Link to={href} {...rest}>{children}</Link>
  );

  <CatalogPage linkComponent={RouterLink} />
  <CategoryPage slug={slug} linkComponent={RouterLink} renderListings={…} />
  <CategoryTreePane linkComponent={RouterLink} />
  <CategoryBreadcrumbsBar slug={slug} linkComponent={RouterLink} />
  <CategoryCarouselStrip linkComponent={RouterLink} />
  ```

  `<CatalogPage>` and `<CategoryPage>` pass it down to everything they compose.
  Omit it and anchors render exactly as before — a host with no router keeps
  working — and it is the same prop `@stapel/listings-react`'s `<ListingCard>`
  takes.

  One detail was load-bearing: antd's `<Breadcrumb items>` renders its own anchor
  when an item carries `href`, which would have bypassed the seam from inside the
  component it lives in. A crumb's link is now its **title**, and the current
  crumb stays a plain label — a link to the page under your feet is not
  navigation.

  `test/linkComponent.test.tsx` asserts the consequence, not the prop: with a
  `linkComponent`, no `<a href>` is rendered on any of these screens.

## 0.2.0

### Minor Changes

- fdbb686: New pair: `@stapel/categories-react` — the catalogue, assembled and kept fresh
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
    `CategoryFeature` _is_ its `FeatureDef`, so the same rows feed
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
