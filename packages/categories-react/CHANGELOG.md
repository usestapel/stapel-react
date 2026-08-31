# @stapel/categories-react

## 0.6.0

### Minor Changes

- 835526f: **The catalogue gets its phone shape: a two-row tile grid that scrolls sideways, and the category landing's quick-search panel.** `<CategoryTileGrid>` and `<CategoryQuickSearchPanel>`, both on `/default`. `<CategoryCarouselStrip>` is untouched — the desktop row stays exactly what it was.

  **`<CategoryTileGrid>`** is the landing row a phone actually wants: rounded `surface-sunken` tiles in two rows, the label top-left over at most two lines, the art pinned bottom-right, and the third column peeking in so the row says it scrolls without a scrollbar, an arrow or a hint line. It leads with an "All" tile linking `basePath` (default `/c`, the same convention the carousel bag already uses), and `allTile={false}` drops it for a row that is already inside a category.

  It is a second surface rather than a `layout` prop on the strip. The strip is a WRAPPING row of cards; this is a fixed grid with a scroll port, a different reading order and a tile whose two corners are doing different jobs. One component with a mode switch would have been one component nobody could photograph either arm of — and the two share the thing worth sharing, the headless `<CategoryCarousel>` bag, so both rows are the same categories in the same order.

  **Every length is a fraction of the CONTAINER.** The column is `100% / 2.5` of the scroll port minus a gap; the tile's height comes from its aspect ratio. A tile sized in viewport pixels is the wrong size inside every sheet, panel and column that is not the whole screen, and this row is mounted inside all three.

  **The image seam is the strip's seam, plus the arm it was missing.** `carousel_icon` / `catalog_icon` are opaque strings the backend deliberately does not resolve, so this skin still builds no URL and renders no `<img>`: it hands the reference to the host through the same `renderIcon(reference, entry)` contract, and a storefront wires its CDN resolver once for both surfaces. What is new is the ABSENCE arm. On the strip, no resolver means a text tile, which is fine for a row of cards; on a tile whose art corner is half its area it reads as a tile that failed to load. So an unresolved reference — no resolver, or a row that carries none — draws a muted placeholder glyph. Never a guessed path, and therefore never a broken image on a deployment that guessed differently.

  **`<CategoryQuickSearchPanel>`** is the brand-tinted block a category landing puts under its tiles: a heading, one or two field slots, and a full-width button whose label carries the live result count.

  **It knows nothing about search, on purpose.** A category package that imported a search package to draw two selects would put the search client in every host of the catalogue and would decide, for every deployment, which facets a category asks about. Neither is this package's call. So the fields are a slot (`fields`) and the count is a value (`count`), both from the container that owns both halves. `count` is core's `LoadState`, and its ready value is field-for-field what `@stapel/search-react`'s new `useSearchCount()` returns — deliberately the same names, so the two connect with no adapter and no import edge between the packages.

  **Only a ready, countable answer earns a number.** Loading, refused, and a ready count the engine declined to give a number for all render the plain "Show listings" — a button that guesses at a total, or that prints "0" because a count was `null`, is exactly the defect the count contract exists to prevent, and a person can press "Show listings" perfectly well without knowing the number first. A LOWER BOUND gets its own sentence ("Show 500+ listings"), because a floor rendered as a total is the same lie in a shorter form.

  New keys in en/ru/es: `categories.tiles.all`, `categories.quick_search.cta`, and the two plural families `categories.quick_search.cta_count` / `…cta_count_at_least` (four forms in ru, two in en/es, as `Intl.PluralRules` says).

- c887a5a: **`<CategoryTileGrid>` takes an `entries` override, so the tile row can draw rows the carousel endpoint does not serve.**

  The carousel bag answers exactly one question: which categories the operator put on the storefront's FRONT PAGE (`carousel_enabled`, `GET /categories/carousel/`). That is the only question a landing asks. A CATEGORY page asks a different one — what is inside this category — whose answer is `useCategoryTree()`'s children, already in the host's hand and not on the carousel endpoint at all. Without a way in, the second surface either re-implemented the tile geometry or drew the wrong rows, and `/c/transport` showed the same five tiles as the home page.

  `entries?: readonly CarouselEntry[]` is that way in, and when it is given the component asks the server **nothing**: `<CategoryCarousel>` is not mounted, so the override costs no `GET /categories/carousel/` — the request a "swap the bag's data" implementation would still have fired and discarded. A test asserts that from the wire rather than from the rendered rows, which is the only place the difference shows.

  An empty array is a real answer — a category with no children — and draws the same empty state a featureless carousel draws. There is no loading or failed arm for an override, deliberately: the host owns the fetch it drew these rows from, so it owns the two sentences that go with it, and handing this component a `LoadState` would give one load two owners.

  `CarouselEntry` is now re-exported from `/default`. It was already part of a skin caller's vocabulary through `renderIcon`; `entries` makes the caller CONSTRUCT one, and reaching into the headless entry for a type you are handed and asked to hand back is a seam with a step in it.

  No new i18n keys.

## 0.5.1

### Patch Changes

- d1125bc: Regenerated against the attributes-v2 contract pins: stapel-categories 0.7.0,
  stapel-listings 0.10.0, stapel-search 0.3.1.

  What moves in the wire types: `FeatureCompact` and `ResolvedFeature` gain
  `rules`, `description`, `example`, `default`, `hints` and `group` — the form
  metadata an imported catalogue actually carries, which is what
  `<FeatureFields>` draws sections, help lines, placeholders and hints from
  instead of a host's hand-written table; `Category` gains `external_id`; the two
  vocabulary-backed value types (`ref_select`, `ref_hierarchical_select`) appear
  in the type enums; and the error registry gains
  `error.400.feature_invalid_rules`.

  search-react's regen is contract metadata only — the facet mapping for the two
  ref types (`term` / `path`, and no `closed_options` for any config carrying an
  `optionsRef`) is decided server-side in stapel-search 0.3.1 and reaches this
  pair as facet rows, not as a new surface.

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
