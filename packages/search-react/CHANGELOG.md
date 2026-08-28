# @stapel/search-react

## 0.8.0

### Minor Changes

- 62c70ac: The classified layout, in the default skins.

  Built where the doctrine says the product lives, so every future classified
  deployment gets it rather than rebuilding it.

  - `shell-react` — `NavDock`, a floating translucent island rather than a flat
    bar: inset from every edge, real border and shadow, safe-area aware. The
    glass is progressive enhancement, not the design — the opaque elevated fill
    is the base and the blur is swapped in only inside an `@supports` for
    `backdrop-filter`, so text contrast never depends on transparency being
    available. Destinations are the first five top-level nav entries in the
    order the manifest already declares, so there is no second selection axis.
    Real links, `aria-current`, and the badge count folded into each link's
    accessible name.
  - `search-react` — a phone gets a scrollable chip row instead of one
    "Filters" button, each chip opening its own `SkinDialog`, and chips carry
    the CHOICE rather than the group name. A desktop gets a sticky full-height
    rail. Both render through one `FacetGroupControl`, so the rail and the
    sheets cannot drift into two implementations — and a group's shape is
    derived from the schema keys the composer's editor already reads
    (`maxSelected: 1` → pills, `hierarchical_select` → indented children)
    rather than a new presentation flag. Plus a list/grid view switch, which is
    not URL state because it changes how an answer is drawn and never what it
    is.
  - `listings-react` — the whole card is one real anchor: photo, price, title
    and location inside it, the favourite heart a sibling button outside it so
    the link cannot swallow it. The separate "open" control is gone and its
    i18n key is retired. Middle-click, open-in-new-tab and crawlers still work,
    and the anchor's accessible name is the title alone.

  Parts of the reference layout that do not fit a generic contract are slots
  with a stated reason rather than invented content: "notify me about new ones"
  (a saved search has an owner, a schedule and a consent record this pair has
  none of), the breadcrumb (a walk up a tree search cannot see), and map view
  (a `SearchView` whose tiles belong to geo-react).

## 0.7.0

### Minor Changes

- 9545a2f: Search: the five blank stories, the phone filter path, money, and the dark scope

  **Five stories rendered nothing.** `results-pane--*` and `filter-panel--*` crashed on
  `data.items.filter` / `data.facet_meta.skipped` — 15 blank shots, including the designed
  empty state. The seeded demos wrote the answer into the query cache and `useSearchQuery`
  sets no `staleTime` (drill-down facets must never serve a stale page), so TanStack
  refetched on mount and the demo `fetch`, which had no handler for a variant that seeded
  instead of mocking, replaced the page with `{}`. A seed now mounts as a handler too, and
  an UNMOCKED path answers 503 rather than an empty 200, so a forgotten handler renders the
  pane's "we could not run this search" arm instead of a white screen.

  **The phone filter sheet had no visual evidence at all** — the only filter path a phone
  has, reachable only by a tap. `<SearchPage defaultFiltersOpen>` opens it on mount (for a
  container that deep-links into the filters), and `search.filter-sheet` photographs it.
  Its commit button now says **"Show 25+ results"** (`useAppliedCount`, cache-only — no
  second request), the sheet no longer prints "Filters" twice (`FacetPanelPane heading`),
  and the opener drops the "(0)" until something is applied.

  **Money.** `3200 RUB` → `₽3,200`, through core's `useFormat().number` with
  `style: "currency"` — the same `Intl` path `@stapel/currencies-react`'s `formatMoney`
  takes. Non-numeric prices pass through; an unusable code falls back to a grouped number.

  **Contrast, touch targets, orphans.** The DSA "Promoted" tag was `warning-on` (white)
  over `warning-bg` (cream) — the one legally mandated string in the package, at ~1.2:1;
  it is `warning` now, in both themes. Degradation banner lines drop `type="secondary"`
  (grey on the warning tint failed AA). `size="small"` is gone from the range Apply/Clear,
  the category/geo/clear-all buttons, so the shared skin's 44px phone control height
  applies. The range Apply is primary when there is something to apply, not before. An
  unfilled `renderGeoFilter` no longer leaves a "Location" heading over empty space in a
  production build, and a facet group with no options draws no heading.

  **Copy.** Scorer slugs are named from the ranking disclosure the pair already fetches
  (`geo_decay` → "Distance"); skipped facet slugs from the category schema (`power_w` →
  "Power"); `applies_to_sorts` through the sort control's own labels; the weight tag is
  labelled; the unreadable-link notice says "price", not `r.price`, and no longer explains
  `from..to` or `lat`/`lon`. New keys `search.filters.show_count{,_at_least}` (plural
  families) and `search.limit.from_link`, in en/ru/es.

  **Layout.** The desktop filter rail is a fixed 280px instead of `Col md={7}` (measured at
  45% of a 1280px page). Result cards carry the photo well filled (`fit` needs a box when
  the snapshot has no aspect) and the whole row is one link when the doc type stores
  `card.url`. The three superseded headless debug-dump demos are gone; their components are
  covered by the skin demos that supersede them.

## 0.6.0

### Minor Changes

- 80617e9: The search page can start a search.

  `setText` had zero callers in the entire repository: the codec carried `q`, the state
  machine could set it, the request sent it, and no screen could type one. Six of the nine
  state setters had no control at all. This release is the missing half of the pair.

  - **`<SearchBox>`** — the query box, debounced (350ms, `replace: true`, so ten letters are
    one history entry), capped at the server's own `MAX_QUERY_CHARS`, with a typeahead over
    `GET /suggest` — an endpoint that had been typed and unreachable since 0.1. `useSearchBox`
    is the headless half; `useSuggest` the hook. Exported, so a container's header can mount
    the same box the page does (`searchBox={false}` then keeps exactly one on screen).
  - **Range filters** — `r.<slug>=from..to` finally has a control. `state/ranges.ts` decides
    which rows exist (numeric features of the category schema, plus any slug the URL already
    constrains); `<RangeFilterRow>` commits on Apply and refuses a backwards range with the
    reason beside the button instead of returning an empty page.
  - **Category, location, language and page size** — `renderCategoryFilter` and
    `renderGeoFilter` are named slots the categories/geo pairs fill, with `SlotPlaceholder`
    where they are not; either way a constraint that arrived in a shared link now has a control
    that widens it again (clear the category, adjust or clear the radius). `<LanguageSelect>`
    and `<PageSizeSelect>` bind `setLanguage` and `setLimit`.
  - **No reason lives in a hover any more.** The pager, the distance sort and the DSA Art. 26
    `promoted` explanation were all `title=`/`<Tooltip>` — invisible on every phone and on
    every disabled button. They are visible text now (`GatedButton`/`GatedControl`, and plain
    copy under the marking). The pager is absent, not dead, when there is nothing to page.
  - **The generic card draws `image_url`** through `@stapel/image` (new optional peer), in an
    aspect box, with the promoted tag on a `--stapel-*` role instead of antd's `gold` preset.
  - **On a phone the filters are a bottom sheet** behind a "Filters (N)" button, through the
    shared `SkinDialog`, instead of a full-width panel stacked above the first result.
  - **The pair's `theme.tsx` and `ErrorAlert.tsx` are deleted** in favour of
    `@stapel/tokens-antd/skin`'s `SkinTheme` / `ErrorAlert` / `EmptyState` / `LoadList`.
    `SearchSkinTheme` is no longer exported (pre-1.0 breaking = minor): import `SkinTheme`
    from the substrate — same props, and a runtime `data-theme` flip repaints it.

  Peers: `@stapel/core >=0.18.0`, `@stapel/tokens-antd >=0.6.0`, `@stapel/image >=0.3.0`
  (optional — only the `/default` skin needs it). The `/default` size budget moves 13 KB → 16 KB.

### Patch Changes

- 308e3d6: Every `/default` surface is drawn, seeded and photographed.

  The skin shipped in the last release with one demo out of twelve names: the pair could
  be read in source and not LOOKED at, which is the state §54's gate exists to end. All
  twelve are covered now, and covered in the state each one is named for.

  - **Eleven new skin demos** — the results pane (found / phone / a search that ran and
    matched nothing), the filter panel (open, and narrowed by a shared link so every
    constraint's door-out is visible), the ranking disclosure, the result card (promoted
    with a photo, and plain), the query box, the sort gate (blocked and open), the page-size
    ladder, the language filter, the numeric range row, the degradation notice (banner and
    inline) and the unreadable-link notice. Each imports from `src/default`, each has a
    `viewport: "phone"` variant, each variant declares the `step` it is seeded at.
  - **Demos are SEEDED, not fetched** (`DemoSeed` in the demo harness): the answer is written
    into the query cache under the key the pair's own codec derives, so a variant opens in its
    state on the first frame instead of photographing the same skeleton under three names.
    `assertVariantsRenderDistinctly` is wired into the demo suite and enforces it.
  - **Dedicated suites** for `useSearchBox` (debounce, one history entry per word, the URL
    winning whenever it moves on its own, the `MAX_QUERY_CHARS` cap), `useSuggest` (the
    three-character floor, the clamped limit, a refusal that leaves the box typeable, a menu
    that stays shut on an empty answer) and the range model (which slugs get a row, what the
    row refuses, and that the reason stands beside the button).
  - **A render matrix per surface** — each of the four surfaces in phone and desktop, light
    and dark, asserting the mode is the DOCUMENT's rather than a default baked into the skin,
    plus the filter surface following the viewport. `setViewport` / `setDocumentTheme` are the
    test harness helpers the setup file has been pointing at.

  No public API change: `src/` is untouched. The demo registry, manifest and `llms.txt` are
  regenerated.

## 0.5.0

### Minor Changes

- d778c54: `<SearchPage>` stops laying out a column for filters that do not exist, and
  stops printing a second heading over the list.

  - The filter column was unconditional. On a deployment whose search plan
    declares no facets that spent a quarter of `/s`, of every category page and
    of every seller page on an illustration saying "no filters for this search" —
    three screens with a hole in them. The page now asks the facet bag what it
    has and gives the results the whole width when the answer is a LOADED zero.
    `loading` and `failed` keep the column: a panel that has not answered yet is
    not a panel with nothing in it, and a layout that reflowed mid-load would be
    worse than the hole. An active filter keeps it too.
  - `resultsHeading` / `<SearchResultsPane heading>`: what this surface calls its
    list. "Results" is only right when the person performed a search — a
    landing's newest-first strip, a seller's page and a category page each wrote
    their own caption above the pane and got "Results" underneath it a moment
    later. The name now goes INTO the heading row that already exists.
  - `filtersHeader`: a slot at the top of the filter column, for a filter this
    pair cannot ship. `SearchQueryState` has carried `geo` since 0.2 and
    `<SortSelect>` already disables "by distance" with the reason "no centre
    set", but nothing here could ever SET one — turning an address into a
    coordinate needs a geocoder, and a geocoder is the deployment's. Whatever a
    host renders here reads and writes the same URL state as the facets beside
    it.
  - `useFacetPanel()` is exported: the same bag as `<FacetPanel>`, for a caller
    that must know what the panel will render before it renders it. A render prop
    cannot answer a question asked one level up.

## 0.4.0

### Minor Changes

- 2d93b52: The count stops lying, and the banner stops crying wolf.

  The pair now reads stapel-search 0.2.0's count contract (pin `v0.2.0`): `count`
  is nullable, `count_is_lower_bound` marks a floor, and `exact_total` describes
  the answer rather than the engine. `page.countKind` turns the three wire fields
  into one decision — `"exact"` renders «25 объявлений», `"at_least"` renders
  «1200+ объявлений» through `tPlural` (a new `search.results.count_at_least`
  family in en/ru/es), and `"unknown"` renders **no count line at all**. The
  state this replaces printed «Примерно 0 объявлений» over four visible cards on
  the live storefront: 0.1.0 had no way to say "we do not know" except `0`.

  `<DegradationNotice>` no longer raises a warning banner for a `degraded[]` that
  contains ONLY `exact_total`. It is a count nuance, not a failed search — the
  rows are right and the consequence is already spoken by the count as "N+" —
  and a banner that cries wolf on every landing page is one nobody reads on the
  day `category_rollup` shows up in it. Beside any other degradation it renders
  as before. Volume is now the container's call: `<SearchResultsPane>` and
  `<SearchPage>` take `degradationNotice?: "banner" | "inline" | "off"`
  (default `"banner"`), so a landing page can pass `"inline"` or `"off"`.

  New exports: `countKind`, `isCountNuanceOnly`, `SearchCountKind`,
  `DegradationNoticeVariant`. `SearchPageInfo.count` is now `number | null` and
  gains `countIsLowerBound` / `countKind`; `countIsEstimate` (both the helper and
  the bag field) is deprecated — it cannot see `count: null`.

## 0.3.1

### Patch Changes

- **Peer floor raised to `@stapel/core >=0.17.0`.** `SearchResultsPane` calls `useTPlural`, which first shipped in core 0.17.0, while the declared floor still said `>=0.15.0`. Inside the monorepo every package compiles against the workspace peer and never against its own floor, so nothing here could have caught it — only a consumer installing at the floor would have, after the release, with a runtime `undefined is not a function` on the results heading. `check:peer-floors` reads each peer's release tags and now sees it; this is the fix, not a suppression.

## 0.3.0

### Minor Changes

- 5246040: A result page that reads like one: plural counts, a grid, and one of each label

  Three findings from a walk over the live storefront, all of them in the pane a
  visitor spends the whole session looking at.

  **The count is counted copy.** `"Примерно {count} объявлений"` was one Russian
  string for every number — right for 5–20, wrong for 1, 2, 3, 4 and 21, which is
  most of the pages a catalogue actually serves. Both count families are now
  CLDR plural families (`.one` / `.other` in en and es, `.one` / `.few` / `.many`
  / `.other` in ru) rendered through core's `tPlural`, and the parity test asks
  `Intl.PluralRules` which forms each locale can land on instead of checking a
  hand-written list. `SEARCH_I18N_PLURAL_KEYS` names the families for a host
  overriding the copy: **a host bundle that overrides
  `search.results.count_exact` / `…count_approximate` should move to per-category
  keys** — the flat key still renders (core falls back to it) but with one ending
  for every number, which is the defect.

  **The results are a grid.** `<Flex vertical>` made every page a one-column
  full-bleed stack; a 1400px catalogue drew two enormous cards and a screenful of
  white. The default is now `repeat(auto-fill, minmax(280px, 1fr))` — as many
  columns as fit, each at least a readable card, one column on a phone, no
  breakpoints to maintain. `renderResults(items)` is the new layout slot above
  `renderCard`: a container that wants a table, a masonry wall or a list beside a
  map replaces the grid entirely, and the pane keeps its four load arms, so
  "nothing matches this search" is never the slot's problem.

  **One heading and one sort control.** `<SearchPage>` captioned its toolbar
  "Results" and then mounted a pane whose own heading says "Results"; the sort
  control printed its label and then repeated it as the select's placeholder,
  with no value showing. The pane now owns the heading row and takes a `toolbar`
  slot beside the count (that is where `<SortSelect/>` goes), the placeholder is
  gone, and `useAppliedSort()` — a new headless hook — reads the sort the SERVER
  reported for the page already in cache, so a URL with no `sort` shows what the
  results are actually ordered by. It subscribes with `enabled: false`: the same
  query key the pane fills, never a request of its own.

## 0.2.0

### Minor Changes

- 6356af8: New package: `@stapel/search-react` — the frontend pair for stapel-search, and
  the one surface a storefront's catalogue, category and search pages all come
  from.

  ```tsx
  const runtime = createSearchRuntime({ baseUrl: "/search/api/v1/" });
  <SearchProvider runtime={runtime}>
    <SearchPage adapter={useRouterSearchParams()} defaultType="listing" />
  </SearchProvider>;
  ```

  No session, no workspace id, no auth client: every endpoint it calls is
  `AllowAny`, so a catalogue renders for a visitor who will never sign in.

  **The URL is the state.** Text, category, facet filters, ranges, geo, sort, page
  size and the keyset cursor all live in the query string, under the backend's own
  parameter names, and no component keeps a second copy. Copying the address into
  another tab reproduces the page, Back removes exactly the last filter, and a
  reload loses nothing — by construction rather than by discipline. Changing any
  of them drops the keyset cursor, because `anchor` is a position inside one
  ordered candidate set and carrying it across a filter change answers page 4 of
  a different search. The router is a two-member seam (`SearchParamsAdapter`);
  `./router` binds react-router's `useSearchParams`, and a Next.js app or a plain
  `URLSearchParams` satisfies the same shape.

  **Facets are drill-down, and the panel shows it.** Each is counted with its own
  filter removed, so picking a value leaves its siblings with the counts you would
  get by switching to them; closed sets keep their authored order, zeros included.
  The server sends no option labels — they are keys in the category's feature
  schema — so `categoryFeatures` is an explicit input and the captions resolve
  through `@stapel/attributes-react`'s `formatFeatureValue`, the same formatter a
  card uses.

  **What the server admits, the screen repeats.** `exact_total: false` renders as
  "about N", `facet_meta.approximate` says the counts are a sample, a skipped slug
  shows "not counted" rather than `0`, and every `degraded[]` literal becomes a
  line in a banner — including one this build has no wording for, which arrives
  with its raw text. A failed search says "we could not run this search" with a
  retry, and `error.400.search_window_exceeded` says "narrow the search"; neither
  is ever spelled "nothing found".

  `promoted` (DSA Art. 26) rides every item under every sort and reaches the card
  slot whole, so a storefront's own `<ListingCard>` can still mark it; the P2B
  Art. 5 ranking disclosure ships as a headless bag and a page, listing even the
  parameters the configured engine cannot evaluate.

  `./default` is the antd skin (`SearchPage`, `SearchResultsPane`,
  `FacetPanelPane`, `RankingDisclosurePane`); the main entry carries no antd and
  no router.
