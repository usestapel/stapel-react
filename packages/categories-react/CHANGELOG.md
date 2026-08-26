# @stapel/categories-react

## 0.5.0

### Minor Changes

- 456b30a: Attribute types become words, the picker becomes a field, and one failure is
  stated once.

  **C-DEVCOPY, the package's worst.** `categories.features.type` was literally
  `"{type}"`, so a public category page badged its attributes `select`, `int`,
  `bool` — and a host's own `holo_signature`. Every value type this build knows
  now has a translated word (en/ru/es) behind `FEATURE_TYPE_LABEL_KEYS`, and a
  type the table does not carry says "Another kind of detail" instead of its
  identifier. The machine name stays on the element as `data-feature-type`, where
  a test reads it and a person does not. `Required` also stops being drawn in the
  danger token — it is a fact about the field, not a failure.

  **NC-FLEXINBUTTON.** `<Flex justify="space-between">` inside an antd `Button`
  shrink-wraps, so every option row came out centred with the chevron hugging the
  label. The flex lives on the button now, rows are on the 44px floor, and the
  phone TRIGGER is a field: a visible label, the value leading, a caret at the
  end. `defaultOpen` mounts the sheet OPEN — the phone story photographed a closed
  trigger, so the sheet it documents had no pixels.

  **NC-DUPESTATE.** The carousel and the tree read the SAME catalogue, so an empty
  or failed one was drawn twice — two stacked `Empty` blocks, two red alerts each
  with its own retry. `CatalogPage` answers for both parts and renders them only
  when there is something to render. `CategoryBreadcrumbsBar` gains
  `onAbsent="quiet"`, which `CategoryPage` passes: one outage no longer produces a
  bare red sentence with a blue link on top of a designed error panel, and an
  unknown slug is not announced twice. That dead end now carries the "Back to the
  catalogue" link its own hint used to promise without offering.

  Tree rows are whole-row links on the touch floor with a chevron for a branch
  (they were 24px words inside 41px rows); catalogue screens get a measure, so the
  "2 subcategories" chip stops sitting 2,300px from the label it counts; and the
  truncation notice stops explaining cache semantics to a shopper.

## 0.4.0

### Minor Changes

- 80617e9: The catalogue screens become the product: the skin is photographed, the two
  composition seams the `/c` routes ship are reachable, and the upstream
  discriminator fix is climbed.

  **Breaking (pre-1.0 ⇒ minor).** `CategoriesSkinTheme`, `CategoriesSkinThemeProps`
  and the pair's own `ErrorAlert` are gone from `@stapel/categories-react/default`.
  Every surface now wraps itself in `SkinTheme` from `@stapel/tokens-antd/skin` —
  which reads the document's LIVE `data-theme` instead of sampling it once, paints
  its own surface, and raises antd's `controlHeight` to 44px below the tablet
  breakpoint. A host that wrapped a composition of these parts imports `SkinTheme`
  (and `ErrorAlert`) from `@stapel/tokens-antd/skin`.

  **The contract chain, climbed.** `src/api/generated/schema.ts` is regenerated
  against stapel-categories 0.6.1: the `FeatureConfig` discriminator this pair
  FILED as a defect is fixed upstream (stapel-attributes 0.4.7), so the ten
  members now carry their real slugs (`type: "bool"`, not `type: "BoolConfig"`).
  The thirty-line apologia in `src/api/types.ts` is deleted and replaced by two
  derived types — `CategoryFeatureConfig` (the slug-keyed union, narrowable) and
  `CategoryFeatureType` — pinned in both directions by `test/contract.test.ts`.

  **Composition seams.**

  - `CatalogPage` accepts and forwards `renderIcon`, so the `/c` route can draw a
    category icon at all; it could not before, whatever the host did.
  - `CategoryPage`'s unfilled `renderListings` renders `<SlotPlaceholder
name="renderListings">` (named in dev, nothing in production) instead of
    silence in the exact place every listing belongs.

  **Phone.** `CategoryPickerField` is a trigger plus a bottom sheet (`SkinDialog`)
  below the tablet breakpoint and the inline list above it; `surface="sheet" |
"inline"` pins the shape.

  **Also:** a feature's `comment` — the catalogue author's note to the person
  filling the form, previously read by nothing in the fleet — renders under the
  feature name via the new `featureCommentLabel`; the sub-category count is a
  translated plural sentence instead of a hover `title=`; `createCatalogStore`
  takes `onUnpersisted` and warns once instead of silently falling back to an
  in-memory catalogue; every load/empty/error arm goes through the substrate's
  `LoadList` / `LoadBoundary` / `EmptyState` / `ErrorAlert`.

  **Demos.** All seven demos now render `src/default` — the antd skin had never
  been drawn in a story, including both nav-mounted screens. 7 demos / 30
  variants, every one seeded into the query cache so its static render IS the
  state it is named for, each with a declared `step`, at least one `phone`
  variant per component, and `assertVariantsRenderDistinctly` in the suite.
  `demo/_harness.tsx`'s `DemoCard` / `StepBadge` debug chrome is deleted.

  New keys (en/ru/es): `categories.category.unknown_slug_hint`,
  `categories.category.subcategories_count.*` (plural family),
  `categories.picker.choose`, `categories.picker.done`. New exports:
  `CATEGORIES_I18N_PLURAL_KEYS`, `featureCommentLabel`, `UNPERSISTED_WARNING`,
  `CategoryFeatureConfig`, `CategoryFeatureType`.

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
