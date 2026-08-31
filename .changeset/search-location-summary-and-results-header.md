---
"@stapel/search-react": minor
---

**The SERP gets the row that says where it is looking: `<LocationSummaryLine>` on `/default`, and a `resultsHeader` slot on `<SearchPage>` to put it in.**

**Why location gets a line of its own when it is already a chip.** The chip row SCROLLS: the geo chip is one of eight and it is off screen the moment somebody has scrolled to "Year". Location is the one constraint on a classified that changes what a result MEANS rather than narrowing a set — "1 200 €" is a different offer in the next city — so it is the one that has to be readable without scrolling anything. Left: a pin, the place, and the radius. Right: the filter affordance with a COUNT.

**The count, not a dot, and it is the same count.** `<FilterChips>`'s leading chip is a 32px circle, so it shows a dot — a number inside it is a number nobody reads. This is a full-width row with a word on it, so the badge says HOW MANY constraints are applied, which is the difference between "something is filtered" and "four things are, and that is why there are three results". Both read `activeFilters` off the URL state; there is no second counter.

**Still never a coordinate.** This pair holds a `lat` and a `lon` and no geocoder, so the line prints the name it was HANDED (`geoLabel`), or says a place is chosen, and adds the radius — which IS a number this pair owns (`radius_km`). With nothing applied it says the search is looking everywhere, which is both the truth and the invitation to narrow it. `test/locationSummary.test.tsx` repeats `geo.test.tsx`'s negative assertion for the new surface: no digit of the point reaches the DOM.

**One location sheet, two doors.** The geo chip's bottom sheet moved into `geoSheet.tsx` and both surfaces mount it, because on the ref both rows carry a location control and a person tapping either must land in the same place. Two copies of a sheet is two places for "clear the location" to drift. `<FilterChips>` keeps its existing test ids; the summary line has its own, so a page holding both rows never hands a test two elements under one name.

**`resultsHeader` is a NEW slot, and the four existing ones were each checked first.** `filtersHeader` is inside the filter panel — on a phone that is behind the sheet, which is precisely where a location summary must not be. `breadcrumb` renders in the right position but names a walk up the CATEGORY tree, so a host wanting a trail AND a location row would have had to choose. `resultsHeading` and the pane's `toolbar` are inside the results pane, below the chips. Nothing sat between the search box and the filters, and that gap is exactly where the ref puts this row. It renders in the page's vertical stack, so it spans the full width in both layouts — above the chip row on a phone, above the two columns on a desktop — because what it states describes the whole page, not the results column of it.

**Saved search is still not here.** The "notify me about new ones" control remains the host's, in the existing `resultsAction` slot, and remains a STUB there: there is no saved-search backend, no subscription, no schedule and no consent record, and this release does not pretend otherwise.

New key in en/ru/es: `search.geo.everywhere` — deliberately not a reuse of `search.geo.clear`, which is the label on a BUTTON that widens the search. The two are the same word in English and diverge the moment a translator reads one as an imperative.
