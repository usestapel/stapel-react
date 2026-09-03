---
"@stapel/search-react": minor
---

**A location filter is never applied unless the person asks for it.** `defaultGeo` is now `geoOffer`, and the provider no longer writes it into the URL.

The old prop applied the host's guess about where a visitor is standing — under four careful rules about not overruling anybody: only into a URL with no location, only once, never after a clear, and late arrivals still count. Every rule held. The outcome, measured on a live classified with the browser's geolocation granted against the same board with it denied:

| leaf | located | not located |
|---|---:|---:|
| a phones category | 15 | 46 |
| a used-cars category | **0** | 2 |
| a tyres category | **0** | 1 |
| a text query for a published, live listing | **0** | 3 |

One permission, granted once for a map on some other page, became a permanent 25 km wall around every category leaf and every query in the deployment — counted as "clear all filters (1)", and drawn as a healthy, well-laid-out page with nothing on it. The rules were not the defect; applying at all was.

- `<SearchStateProvider geoOffer>` / `<SearchPage geoOffer>` hand the same value over and commit nothing. The bag exposes `geoOffer` (retired automatically once the search carries a location of its own) and `acceptGeoOffer()`.
- `<LocationSummaryLine>` draws it as **"Near me · within N km"** beside the sentence it would change. It states its own radius: nobody should accept a number they cannot see. Pressed, it PUSHES, so Back is the way off.
- `<FilterChips>` gives an applied location a clear button of its own (`search-chip-geo-clear`) — a location chip can empty a whole page, and reversing it should not require first learning that the chip opens a sheet.
- Two defects fall out with it. **The URL is never rewritten behind the visitor**, so a hand-typed `radius_km` is their word and survives verbatim. And the results are fetched **once** instead of being fetched and immediately superseded by a second, narrower query — the permanent `ERR_ABORTED` in every network log.

`test/geo.test.tsx` pins all of it, including the request count.

**Migration:** rename `defaultGeo` to `geoOffer`. A host that wants the old behaviour must now draw a control for it; there is no prop that restores it.
