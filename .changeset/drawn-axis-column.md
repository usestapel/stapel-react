---
"@stapel/search-react": minor
---

The filter rail builds its choice groups before its ranges, so a counted axis
it cannot draw keeps its from/to row.

`buildRangeGroups` removes a range whose slug already has a bucket list on the
rail — one axis, one control. It was told which slugs those were by the
server's `facet_meta.counted`, which is not the same set as the one the rail
draws. On a live flats leaf `square` was counted with thirty-odd bare integers
behind it, `buildFacetGroups` built no group for it (an `int` is not in
`FACETABLE_FEATURE_TYPES` — a number is narrowed with two bounds, not a
checkbox per value), and the rule then dropped its range row in favour of a
bucket list nothing renders. The total-area filter existed in neither column,
and an independent walk of the rail's eighteen sections confirmed it.

Fixed as an ordering change rather than a heuristic. `FacetPanelPane` computed
`drawable` after the ranges were built; it now computes it first and passes
those slugs as `countedFacets`. Two heuristics were tried inside
`buildRangeGroups` and both were wrong — nothing in a feature definition
separates `square` from an imported `year`, which is a raw int whose bucket
list IS wanted. Only the rail knows which groups it drew.

`buildRangeGroups` itself is unchanged and a caller that keeps passing the
server's list keeps the old behaviour; the field's contract note now says
which set it wants.
