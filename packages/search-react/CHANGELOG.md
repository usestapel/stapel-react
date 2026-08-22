# @stapel/search-react

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
