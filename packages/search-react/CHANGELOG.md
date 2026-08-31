# @stapel/search-react

## 0.11.0

### Minor Changes

- The three things a buyer's SERP owes them, measured missing on a live classified board.

  **A price filter.** The panel offered seven numeric ranges — parcel weight, length,
  height, width, packing quantity, minimum-order quantity, battery condition — and no
  price, because a range row was only ever drawn for a CATEGORY FEATURE and price is a
  column of the listing. `buildRangeGroups` now takes `coreRanges` from the answer's
  `facet_meta.core_ranges` (stapel-search 0.4.0) and draws those axes FIRST, marked
  `core: true`. It comes from the server on purpose: hardcoding `"price"` would have
  fixed that board and broken the next one, where `r.price` still answers zero. The
  row reads as money — the corpus currency is read off the cards of the same answer,
  so no host wires anything — and the unit now shows in the row heading, where until
  now it existed only in an `aria-label`.

  **Captions, not storage slugs.** `buildFacetGroups` takes `facetLabels` from the
  answer (`{slug: {translatable, values}}`) as the FLOOR under `categoryFeatures`. The
  schema still wins where it resolves — the client fetched it with its own
  `Accept-Language` — but the schema slot is OPTIONAL, a live board never filled it,
  and its buyers read "Condition: b-u", "Listing kind: prodayu-svoe", "Screen
  condition: bez-defektov" on the SERP and in the filter chips. A caption that arrives
  with the counts cannot be forgotten by a host. `translatable` says whether the
  caption is a key or literal text, because the reader cannot tell by looking.

  **No engine diagnostics in a buyer's face.** Every query, for every buyer, raised a
  full-screen yellow "What this search could not do: synonyms were not substituted —
  the search engine in use cannot do this" between the sort control and the first
  card. New `degradationAudience` / `readerFacing` split `degraded[]` by who it is
  addressed to: `typo_tolerance`, `phrase_synonyms` and `exact_total` describe the
  ENGINE somebody licensed and no longer reach a reader; `category_rollup`,
  `exact_facet_counts`, `scorer:` and unknown literals change what the page MEANS and
  still do. Note what the fix is not — the string was not deleted and the kind was not
  special-cased; the audience got a name, so the next engine-capability literal is
  filtered by the same rule. `<DegradationNotice variant="debug">` shows everything,
  for a status page.

  Contract re-pinned to stapel-search 0.4.0 (`>=0.4 <0.5`).

## 0.10.0

### Minor Changes

- c887a5a: **The SERP gets the row that says where it is looking: `<LocationSummaryLine>` on `/default`, and a `resultsHeader` slot on `<SearchPage>` to put it in.**

  **Why location gets a line of its own when it is already a chip.** The chip row SCROLLS: the geo chip is one of eight and it is off screen the moment somebody has scrolled to "Year". Location is the one constraint on a classified that changes what a result MEANS rather than narrowing a set — "1 200 €" is a different offer in the next city — so it is the one that has to be readable without scrolling anything. Left: a pin, the place, and the radius. Right: the filter affordance with a COUNT.

  **The count, not a dot, and it is the same count.** `<FilterChips>`'s leading chip is a 32px circle, so it shows a dot — a number inside it is a number nobody reads. This is a full-width row with a word on it, so the badge says HOW MANY constraints are applied, which is the difference between "something is filtered" and "four things are, and that is why there are three results". Both read `activeFilters` off the URL state; there is no second counter.

  **Still never a coordinate.** This pair holds a `lat` and a `lon` and no geocoder, so the line prints the name it was HANDED (`geoLabel`), or says a place is chosen, and adds the radius — which IS a number this pair owns (`radius_km`). With nothing applied it says the search is looking everywhere, which is both the truth and the invitation to narrow it. `test/locationSummary.test.tsx` repeats `geo.test.tsx`'s negative assertion for the new surface: no digit of the point reaches the DOM.

  **One location sheet, two doors.** The geo chip's bottom sheet moved into `geoSheet.tsx` and both surfaces mount it, because on the ref both rows carry a location control and a person tapping either must land in the same place. Two copies of a sheet is two places for "clear the location" to drift. `<FilterChips>` keeps its existing test ids; the summary line has its own, so a page holding both rows never hands a test two elements under one name.

  **`resultsHeader` is a NEW slot, and the four existing ones were each checked first.** `filtersHeader` is inside the filter panel — on a phone that is behind the sheet, which is precisely where a location summary must not be. `breadcrumb` renders in the right position but names a walk up the CATEGORY tree, so a host wanting a trail AND a location row would have had to choose. `resultsHeading` and the pane's `toolbar` are inside the results pane, below the chips. Nothing sat between the search box and the filters, and that gap is exactly where the ref puts this row. It renders in the page's vertical stack, so it spans the full width in both layouts — above the chip row on a phone, above the two columns on a desktop — because what it states describes the whole page, not the results column of it.

  **Saved search is still not here.** The "notify me about new ones" control remains the host's, in the existing `resultsAction` slot, and remains a STUB there: there is no saved-search backend, no subscription, no schedule and no consent record, and this release does not pretend otherwise.

  New key in en/ru/es: `search.geo.everywhere` — deliberately not a reuse of `search.geo.clear`, which is the label on a BUTTON that widens the search. The two are the same word in English and diverge the moment a translator reads one as an imperative.

- 835526f: **"How many results would this give me?" is a hook now — and it says out loud that the backend has no way to answer it cheaply.** `useSearchCount(state)`, headless, from the package root.

  A quick-search panel's button ("Show 128 listings") has to know the total for a state that is not on screen and not in the URL: the person is still composing it. `<SearchResults>` cannot answer that — it reads the committed URL state — and `useAppliedCount` deliberately reads the page already in cache rather than issuing a search of its own. So this is a read over a state the caller hands in, and it returns the fleet's shape for one: `LoadState<{ count: number | null; kind: SearchCountKind }>`.

  **There is no count-only endpoint, and this hook rides the full query on purpose.** `SearchApi` is `query`, `suggest` and `ranking`; nothing answers "how many" without also assembling a page. So the request is the ordinary `/query` with `limit=1` and `facets=off`, and the total comes out of the envelope. That has a real cost — the engine still ranks the candidate set — and it is written into the hook's doc comment rather than hidden behind a name that sounds cheap. **Follow-up for stapel-search:** a `GET /count` verb answering the three count fields plus `degraded[]` and nothing else. When it lands, this hook's body changes and its signature does not.

  **What is dropped from the state is the interesting half.** `anchor`/`direction` go, because a cursor asks about a PAGE and a count is about the whole set (keeping one would also cache the same total once per page somebody walked through). `sort` goes, because the total does not depend on the order and keeping it would miss the cache on every sort change. `facets` goes to `"off"`, because counting facets is the expensive half of a request that draws no facet panel. Everything that changes the ANSWER — `q`, `category`, `owner`, filters, ranges, geo, `lang` — is sent exactly as a real search would send it. `countQueryState()` is exported so this is readable rather than inferred.

  **The debounce is the mitigation the endpoint gap forces.** The FIRST state is asked about immediately — a panel that opens should not wait a quarter second to say its number — and every change after that is coalesced onto the LAST one (`SEARCH_COUNT_DEBOUNCE_MS`, 250ms; `0` disables it). Typing "hond" then "honda" asks once, about "honda", never about "hond" late. `enabled: false` holds the hook at `loading` for a panel still resolving its category.

  **The kind travels with the number.** `"exact"` is a total, `"at_least"` is a floor, `"unknown"` is the engine declining to say — and `count: null` under `"unknown"` is never rendered as `0`. That is the same contract `state/degradations.ts` states for the results page, reused rather than restated, so a counted button cannot drift from a counted heading.

  Also exported: `SEARCH_COUNT_PAGE_SIZE`, `SEARCH_COUNT_DEBOUNCE_MS`.

## 0.9.1

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

## 0.9.0

### Minor Changes

- e1b1d9b: **A location is now said in words, and a search can open where the visitor is.** `geoLabel` and `defaultGeo` on `<SearchPage>`; `geoLabel` on `<FacetPanelPane>` and `<FilterChips>`; `defaultGeo` on `<SearchStateProvider>`.

  **The panel printed coordinates.** Under the "Location" heading, on the desktop rail and on the phone's location chip, a person who had chosen a place on a map read `Around 55.756, 37.617`. That is the pair's own storage leaking onto the screen: `lat`/`lon`/`radius_km` are URL parameters because the URL is the state, and none of that is a display concern. Two numbers to three decimals cannot be checked by the one reader who could have checked an address — so a point that landed in the wrong suburb looked exactly as authoritative as the right one, and the right one looked like machinery. It is the same defect class this pair is careful about everywhere else: a value rendered as if it were an answer, when nobody can tell whether it is.

  **`geoLabel`** is what the constraint is CALLED. Whoever turned an address into that point still has the address — the geocoder's own answer, the city an IP guess named, the text on the map pin — and hands it back: `geoLabel="Tverskaya, Moscow"`. Set it once on `<SearchPage>` and both filter surfaces take it, so the chip row and the rail cannot drift into describing the same URL two different ways. Without one the line reads **"A chosen place on the map"** (`search.geo.chosen_place`, en/ru/es) — an honest sentence about a place this package genuinely cannot name, because naming it needs a geocoder and a search package must not grow one to fix a bad line. `search.geo.center` (`"Around {lat}, {lon}"`) is **removed** from the key registry and from all three bundles; the bbox sentence is unchanged, since an area on the screen was always describable without measuring it.

  **`defaultGeo` — the search opens where the visitor is.** A storefront that knows roughly where somebody is standing should not make them type it: a granted browser prompt, or the server's IP guess when there was none. The host resolves it — `usePermission("geolocation")` and a geocoder both live outside this pair — and passes the two numbers in. The page still does not know what a map is.

  Everything hard about the feature is about not overruling anybody, and the URL is what makes the rules statable:

  - **Only into a URL that carries no geo at all.** A link with `lat`/`lon` or `bbox` already means a place, and it must mean the same place for everyone who opens it. A default that overwrote it would turn one address bar into two different searches.
  - **Once, and never again after a clear.** Tracked as "has anyone spoken about location yet" in a ref, not by comparing the default against the current value — a cleared location and an unapplied default are identical in the state, and only the record of who spoke tells them apart. `setGeo` marks the question answered, including when the answer is "anywhere".
  - **Late is fine.** A permission prompt and an IP round trip both resolve after the first paint, so `undefined` on mount and a value three renders later still applies — provided the URL is still empty of geo at that moment. The prop is typed `SearchGeo | undefined` for exactly this, so a host passes what it has without a conditional spread.
  - **It replaces the history entry rather than pushing one.** The visitor did not perform this change; Back should leave the page, not undo a centring they never asked for. The adapter seam has carried `{ replace: true }` since it was written, and the react-router binding honours it.

  Tests cover all four rules plus the wire the centred search actually goes out on, and assert the coordinate's own digits appear nowhere in the rendered page — on either surface, in a chip, a heading or an aria-label — because a future sentence that quietly reintroduces them under a different key is the same defect.

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
