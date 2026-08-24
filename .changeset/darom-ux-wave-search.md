---
"@stapel/search-react": minor
---

`<SearchPage>` stops laying out a column for filters that do not exist, and
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
