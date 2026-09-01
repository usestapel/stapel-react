# @stapel/categories-react

## 0.9.0

### Minor Changes

- f69b42b: The catalogue walk is SERVER-DRIVEN: one small request per rung, and the tiles
  hand over to the cascade instead of to nothing.

  Measured on a live 3583-row classified catalogue, the whole-tree sync every
  surface mounted cost **36 requests / 1.4 MB / 20.2 s** before a category picker
  could draw its first select; one rung of `GET {id}/children/` costs **1 request
  / 1-4 KB / 0.25-0.39 s**. The tree is only "already in memory" once somebody
  has waited twenty seconds for it.

  - `useCategoryCascade` reads `GET {id}/children/` per rung and takes the chain
    a deep value implies from that value's own `tn_ancestors_pks`
    (`GET {id}/`, 300 bytes). A ROOTED ladder — the one a category landing
    mounts — never touches the catalogue. The rungs above a pending one stay on
    screen, so the ladder grows downward rather than blanking.
  - `<CategoryPage subcategories="tiles">` past the depth cap now renders the
    CASCADE. It rendered nothing, which on that catalogue left 2924 of 2924
    active leaves — every category that has any characteristics — unreachable by
    browsing from a phone, while the same URL at 1440px descended in three taps.
  - `<CategoryPage categoryId={…}>` is the fast address: two small reads, no
    catalogue. `slug` still resolves against the sync, because the server has no
    slug lookup. `onNarrow` / `narrowValue` report a cascade choice to the host.
  - `<CategoryBreadcrumbs categoryId={…}>` builds the trail from the server's own
    ancestry, one 300-byte read per crumb.
  - New reads: `retrieve` on the API, `useCategory`, `useCategoryRows` and
    `useCategoryLevels`.
  - `useCategoryCascade` takes `roots` — the escape hatch for the one rung the
    server cannot answer (there is no roots endpoint and no `tn_parent` filter).
    Both that and a slug lookup are recorded in MODULE.md as upstream asks.

  Breaking, pre-1.0: the cascade bag and `CategoryCrumb` carry `Category` rows
  rather than built `CategoryNode`s (a node can only come from a whole tree, and
  needing one is the same as needing all of it); `buildCategoryCascade` and
  `cascadeReachedLeaf` take fetched rungs plus a chain of ids; `SubcategoryForm`
  gains `"cascade"`.

## 0.8.0

### Minor Changes

- 3ffadeb: The cascading child selector the tile cap hands over to — `useCategoryCascade`,
  `<CategoryCascade>`, `buildCategoryCascade` and the `<CategoryCascadeField>`
  skin.

  `catalog/tiles.ts` has capped tile navigation at the second level of the tree
  since 0.7.0, on the rule that everything deeper is chosen "as a characteristic,
  through cascading child selectors". The cap was enforced and the selector did
  not exist, so on a live classified catalogue — 3583 categories, 3036 of them
  leaves — only 198 rows were reachable, a level-2 page answered `[]` from
  `{id}/features/` (features resolve by inheritance, so a category whose own rows
  are empty legitimately has none), and its child answered 59. A person was told,
  truthfully, that the category has no characteristics, one tap above the ones
  that make it usable.

  One primitive serves both surfaces, because the owner's model requires the same
  gesture when filtering and when posting. The ladder is a pure function of
  (index, root, cursor) — a rung is derived from the chain above it rather than
  remembered, so changing one cannot leave a stale answer below it. `commit`
  is the only difference between the two: `"any"` for a filter (a category path
  matches as a prefix, so a parent finds its descendants), `"leaf"` for a composer
  (a non-leaf inherits the wrong feature set). Counts per option are a host prop
  and are unfilled: no server can currently answer them, and MODULE.md carries the
  exact shape asked for upstream rather than a number nobody could check.

  `<CategoryPickerField>` is untouched and stays the right control for a search
  across a whole catalogue.

## 0.7.0

### Minor Changes

- 7f23ccf: The catalogue stops offering rows nobody may browse, tiles stop at the second
  level, and a query can reach a category.

  **The browse projection.** `GET /categories/` is a REVISION-SYNC contract and
  is right to keep sending rows a shopper may not see — a consumer that never
  received a row again could never learn it went inactive. So the filter belongs
  on the consumer. On a live classified deployment the list endpoint answers 187
  rows of which 105 are `active: false`, end-to-end leftovers, and every browse
  surface offered them. `isBrowsableCategory` / `browsableCategories` /
  `ADMIN_VISIBILITY` (`catalog/browse.ts`) are the one predicate the tile grid,
  the carousel, the tree walk and the children hook now share: `active`
  (absent means active — the flag is optional and defaults true on the model),
  `deleted` (a tombstone, deliberately still served), and `is_test` read
  defensively off the wire because the pinned schema does not declare it, where
  ABSENT means "not a test row". It never pattern-matches slugs: a heuristic
  that drops `authz-…` also drops the real category somebody named `winter-2026`,
  and a silently deleted branch is a worse failure than a visible test row. The
  sync CACHE still ingests every row — only the projection over it filters, or
  the next delta breaks.

  **Tiles are two levels.** Level 1 on the home screen and a top-level
  category's children on its landing; below that a category is a
  CHARACTERISTIC, chosen through cascading child selectors when filtering or
  posting, not a tile to navigate into. `MAX_TILE_DEPTH` /
  `categoryOffersTileGrid` / `nodeOffersTileGrid` (`catalog/tiles.ts`) are that
  rule as one exported number, so the search and composer surfaces read the
  same one. `<CategoryTileGrid categoryDepth>` renders nothing past the cap —
  not an empty state, because nothing is absent: the sub-categories exist and
  are offered in a different shape — and it returns before mounting the
  carousel bag, so it issues no request it would discard.

  **One subcategory list, not two.** `<CategoryPage subcategories>` takes
  `"pane" | "tiles" | "none"` and MOUNTS exactly one; the other is absent from
  the document rather than hidden. Without it a host wanting tiles had to mount
  the grid as well and hide `<CategoryTreePane>` with its own stylesheet, which
  a live deployment was doing — the same links rendered twice. `"pane"` stays
  the default, so no existing host changes. The page also takes `renderIcon`
  and forwards it to the tiles arm, which otherwise could never draw art.
  `categoryTileEntry` is the row→tile mapping lifted out of
  `<CategoryCarousel>`: it held the only copy of the `carousel_icon` →
  `catalog_icon` → `null` fallback order (with `""` read as absent), and a
  second copy would have drifted on the one detail that is invisible when wrong.

  **A query reaches a category.** `useCategorySearch` /
  `rankCategoryMatches` / `<CategorySearchHits>` match a free-text query against
  the categories the browse projection has ALREADY loaded — exact name, then
  prefix, then substring, case- and diacritic-insensitive, over the localized
  label and the slug, capped. No request per keystroke, and nothing the browse
  projection hides can be reached through it. It is a list of category links,
  not a picker and not a typeahead over the whole tree.

- 7994c0d: `<CategoryPage breadcrumbs>` and a picker that stops printing its label twice.

  **The trail is a deployment's decision.** `breadcrumbs={false}` mounts no
  crumb bar — absent from the document, not covered. Which chrome carries "where
  am I" is a navigation decision and both answers are right: on a desktop the
  trail IS the catalogue's navigation, the only affordance on screen for moving
  back up the tree; on a phone the reference design gives that job to the app
  bar's back arrow, and a crumb row above the title repeats it in a second
  visual language while spending one of four lines above the fold. A live
  classified deployment had exactly that, as a `display: none` under a media
  query with an upstream ask attached — and a host hiding a pair's output with a
  stylesheet is the pair's bug.

  **The picker's visible heading goes.** `<CategoryPickerField>` is mounted
  inside somebody else's form, whose form item already prints "Category" above
  it; a second copy underneath is the same word twice in two type sizes, which
  reads as two stacked controls. It is dropped from the SCREEN and not from the
  accessibility tree — mounted bare, the trigger would otherwise be a button
  whose only name is the value inside it ("Phones, button", with nothing saying
  what Phones is a choice OF), so the name is still authored, still translated,
  and `visuallyHidden` keeps it in the tree, joined to the value rather than
  replacing it. The SHEET keeps its visible title on the same key: there the
  word duplicates nothing, and a dialog with no header is a panel that appeared.

- 8d1e20f: The phone dock stops truncating its labels, stops covering the footer, and the
  phone SERP gets a one-line toolbar instead of four stacked rows.

  **A compact label for a compact chrome.** `NavEntry.shortLabelKey` (core) is an
  optional second i18n key a manifest declares when its menu label cannot fit a
  dock cell. A five-item dock at 390px gives each destination about ten
  characters, and a label written for a menu row ellipsizes mid-word — a
  destination a person has to guess at, which is the one thing a dock must not
  produce. A key and not a length hint, because which words survive the cut is a
  translator's judgement: the useful short form of "Post a listing" is the verb,
  of "My listings" the noun, and no truncation rule finds either. `resolveNav`
  carries it through, `<NavDock>` prints it and keeps the LONG label as the
  link's accessible name; `listings-react` declares one for `compose` and `mine`.
  The dock also drops its inter-cell gap and one inset step — 24px given back to
  five labels — and `scripts/gen-nav-manifest.mjs` validates the new field.

  **The clearance belongs to the page, not the content.** The island is fixed
  over the last thing on the page, and the last thing is the footer. Reserving
  `DOCK_CLEARANCE` on `<Layout.Content>` cleared the final card and left the
  footer's legal links permanently under the island. `<PublicShell>` reserves it
  on the page column instead, and only when `dockRenders(nav)` says an island
  will actually be drawn — a one-entry nav used to get a strip of empty page
  under a dock nobody rendered.

  **A phone toolbar that is one row.** `<SearchResultsPane header="compact">`
  gives the toolbar its own line and puts the count directly above the cards as
  their caption, with the heading visually hidden but still in the document
  outline; the banner shape (heading | count + toolbar) is unchanged and
  remains the default. `<SortSelect compact>` drops the caption and the 200px
  floor so the control shares a row, and moves the blocked `distance` option's
  REASON into the option's own label — on a phone, where that refusal is most
  common, a separate reason row costs a band of viewport above the first result.
  `<FilterChips>` takes `geoChip={false}` for a surface that already states the
  location above it (the phone SERP mounts `<LocationSummaryLine>`, and the two
  together asked about one filter twice), and renders NOTHING when it would be a
  row of one button — a free-text query has no category, so the server returns no
  facet plan, and the row was a lone circle floating between two working filter
  affordances. `<LocationSummaryLine>` says "Filters", not "All filters": that
  end of the row shares 390px with a place name.

  **Tiles say which category they are.** `<CategoryTileGrid>` draws the
  category's own initial where art is missing, instead of a muted disc. A live
  catalogue put nine identical grey discs on one landing — every category there
  carries an empty `carousel_icon`, which is the state every catalogue is in
  until somebody uploads art — and a grid of them reads as nine images still
  loading. A letter cannot be mistaken for a pending image, and every tile
  differs from every other.

  **`visuallyHidden`** (tokens-antd `/skin`) is the fleet's one off-screen-but-
  announced style. It was written twice before, in `calendar-react` and
  `search-react`, and the two disagreed on `clip-path` versus the deprecated
  `clip`; both now import it.

### Patch Changes

- e738b83: Regenerated against the contracts the fleet actually installs.

  `contract-pins.json` moves stapel-search 0.4.0 → 0.7.0 and stapel-categories
  0.7.0 → 0.9.0 — the two pins the freshness gate reported as three and two
  minors behind, and the two versions a live classified deployment now runs. A
  pair regenerated from a stale pin is internally consistent and wrong about the
  wire, which is the whole reason the gate exists.

  What the regeneration brings in:

  - `search-react`'s `GET /suggest` grows `categories[]` — a destination per row
    with its full ancestor path, the number of LIVE listings behind it and a
    `category` string to pass verbatim to `/query`, ranked by that count. The
    answer is now public and conditional (`Cache-Control` + `ETag`), which is
    what makes a per-keystroke read reasonable.
  - `categories-react`'s feature-config union gains `group` — attributes v2's
    container type, whose config holds its children as raw dicts each
    discriminated by its own `type`, plus an optional `repeat`. The pair's
    discriminator contract test pins thirteen members instead of twelve; it
    checks in both directions on purpose, and this is the direction that was
    supposed to fire.
  - `calendar-react` and `search-react` raise their `@stapel/tokens-antd` peer
    floor to the release that first ships `visuallyHidden`, which both now
    import. The monorepo cannot catch that by building — in here every package
    compiles against the workspace peer, never against its own declared floor —
    so only a consumer installing at the floor would have found it, after the
    release.

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
