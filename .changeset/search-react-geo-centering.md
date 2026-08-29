---
"@stapel/search-react": minor
---

**A location is now said in words, and a search can open where the visitor is.** `geoLabel` and `defaultGeo` on `<SearchPage>`; `geoLabel` on `<FacetPanelPane>` and `<FilterChips>`; `defaultGeo` on `<SearchStateProvider>`.

**The panel printed coordinates.** Under the "Location" heading, on the desktop rail and on the phone's location chip, a person who had chosen a place on a map read `Around 55.756, 37.617`. That is the pair's own storage leaking onto the screen: `lat`/`lon`/`radius_km` are URL parameters because the URL is the state, and none of that is a display concern. Two numbers to three decimals cannot be checked by the one reader who could have checked an address — so a point that landed in the wrong suburb looked exactly as authoritative as the right one, and the right one looked like machinery. It is the same defect class this pair is careful about everywhere else: a value rendered as if it were an answer, when nobody can tell whether it is.

**`geoLabel`** is what the constraint is CALLED. Whoever turned an address into that point still has the address — the geocoder's own answer, the city an IP guess named, the text on the map pin — and hands it back: `geoLabel="Tverskaya, Moscow"`. Set it once on `<SearchPage>` and both filter surfaces take it, so the chip row and the rail cannot drift into describing the same URL two different ways. Without one the line reads **"A chosen place on the map"** (`search.geo.chosen_place`, en/ru/es) — an honest sentence about a place this package genuinely cannot name, because naming it needs a geocoder and a search package must not grow one to fix a bad line. `search.geo.center` (`"Around {lat}, {lon}"`) is **removed** from the key registry and from all three bundles; the bbox sentence is unchanged, since an area on the screen was always describable without measuring it.

**`defaultGeo` — the search opens where the visitor is.** A storefront that knows roughly where somebody is standing should not make them type it: a granted browser prompt, or the server's IP guess when there was none. The host resolves it — `usePermission("geolocation")` and a geocoder both live outside this pair — and passes the two numbers in. The page still does not know what a map is.

Everything hard about the feature is about not overruling anybody, and the URL is what makes the rules statable:

- **Only into a URL that carries no geo at all.** A link with `lat`/`lon` or `bbox` already means a place, and it must mean the same place for everyone who opens it. A default that overwrote it would turn one address bar into two different searches.
- **Once, and never again after a clear.** Tracked as "has anyone spoken about location yet" in a ref, not by comparing the default against the current value — a cleared location and an unapplied default are identical in the state, and only the record of who spoke tells them apart. `setGeo` marks the question answered, including when the answer is "anywhere".
- **Late is fine.** A permission prompt and an IP round trip both resolve after the first paint, so `undefined` on mount and a value three renders later still applies — provided the URL is still empty of geo at that moment. The prop is typed `SearchGeo | undefined` for exactly this, so a host passes what it has without a conditional spread.
- **It replaces the history entry rather than pushing one.** The visitor did not perform this change; Back should leave the page, not undo a centring they never asked for. The adapter seam has carried `{ replace: true }` since it was written, and the react-router binding honours it.

Tests cover all four rules plus the wire the centred search actually goes out on, and assert the coordinate's own digits appear nowhere in the rendered page — on either surface, in a chip, a heading or an aria-label — because a future sentence that quietly reintroduces them under a different key is the same defect.
