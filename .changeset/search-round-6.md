---
"@stapel/search-react": minor
---

Two fixes from the reference census (2026-09-04): the rail no longer picks
between two different "no filters" sentences, and it inlines twice as many
groups before folding.

**One empty state, and only when the rail truly has nothing.** The facet
panel used to say "This search offers no filters" when the group list was
empty, and a SECOND sentence — "N filters apply to too few of these
results" — when the server had counted groups and withheld them for
covering too little of the result set (D175). A reference catalogue checked
against the same shape says neither: it leaves the filters visible with low
counts and explains nothing. `search.facets.withheld` and its plural
catalogue entries are gone from every locale; `FacetsEmptyArm` now says
nothing at all when groups were withheld or skipped, or when the rail is
already drawing a price row, an applied location, or the partition slot
(`hasOtherDrawable`) — `search.facets.empty` is the one sentence left, for
the one case none of that is true. A host that still wants the withheld
count for its own copy reads `data-withheld` off the (otherwise empty) arm.

**`visibleGroups` defaults to 16 in the desktop column, 8 in the phone
sheet.** The reference inlines roughly two dozen groups in its rail before
anything folds behind "all filters"; this pair folded at eight everywhere,
which on a wide rail was the make, the price and little else. `<SearchPage>`
now defaults `visibleGroups` per layout — 16 in the column
(`FACET_VISIBLE_GROUPS`, also `<FacetPanelPane>`'s own bare default), 8 in
the sheet, where a person has already paid one tap to get there and folding
its tail again saves less than folding a column's does. Both stay overridable
through the same prop.
