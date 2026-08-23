# @stapel/search-react

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
