---
"@stapel/search-react": minor
---

**A place is not a filter, and no place is applied unless the person asks for one.** `defaultGeo` becomes `geoOffer`, the location gets one control of its own, and `lat`/`lon` leave the filter list entirely.

The old prop applied the host's guess about where a visitor is standing — under four careful rules about not overruling anybody: only into a URL with no location, only once, never after a clear, and late arrivals still count. Every rule held. Measured on a live classified with the browser's geolocation granted, against the same board with it denied:

| leaf | located | not located |
|---|---:|---:|
| a phones category | 15 | 46 |
| a used-cars category | **0** | 2 |
| a tyres category | **0** | 1 |
| a text query for a published, live listing | **0** | 3 |

One permission, granted once for a map on some other page, became a permanent 25 km wall around every category leaf and every query in the deployment. The owner's own words for what that looked like from his chair: *"the landing turns itself into a search with 0 listings after two seconds, with two active filters I can't even look at"* — and clearing them bought two more seconds before it happened again. The rules were not the defect; applying at all was, and counting a coordinate as a filter is what made the cause unnameable.

**Nothing is applied on this pair's initiative.**
- `<SearchStateProvider geoOffer>` / `<SearchPage geoOffer>` take the same value and commit nothing. The bag exposes `geoOffer` (retired once the search carries a place of its own) and `acceptGeoOffer()`.
- Two defects fall out with it. The URL is **never rewritten behind the visitor**, so a hand-typed `radius_km` is their word and survives verbatim. And the results are fetched **once** instead of being fetched and immediately superseded — the permanent `ERR_ABORTED` in every network log. `test/geo.test.tsx` asserts the request count, and asserts that a page left alone for twenty settles does not move its own URL, history or results.

**A latitude is not a filter.**
- `activeFilterCount` counts facet values and ranges. Nothing else. A count that named nothing was worse than no count: it told a person something was hiding their results and gave them nothing to press.
- `clearFilters` leaves the place alone for the same reason — it is not one of the things that control counts, and widening a price range is not a request to be moved back to the whole country.
- The geo chip is gone from `<FilterChips>`, and the "Location" group is gone from `<FacetPanelPane>` (with its `renderGeoFilter` and `geoLabel` props).

**One location control, on every results surface.**
- `<SearchPage>` mounts `<LocationSummaryLine>` itself — a place on the left, its radius beside it, the sheet behind both — instead of leaving it a slot each host had to remember to fill. One of them did not: a category results page had no way to say where it was looking while `/s` had one.
- The radius moved into that sheet, beside the place it is a radius **of**. It exists only once a place is set, and clearing the place clears it too.
- With no place set and an offer standing, the row reads **"Near me · within N km"**. It states its own radius: nobody should accept a number they cannot see. Pressed, it pushes, so Back is the way off.
- `filtersDoor={false}` drops the trailing "Filters (N)" where the panel is already on screen.

**Migration:** `defaultGeo` → `geoOffer` on `<SearchPage>`/`<SearchStateProvider>`. `renderGeoFilter`/`geoLabel` stay on `<SearchPage>` and are removed from `<FacetPanelPane>`/`<FilterChips>`; the page routes them to the location control. A host that mounted `<LocationSummaryLine>` in `resultsHeader` should stop — the page draws one.
