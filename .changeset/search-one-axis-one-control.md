---
"@stapel/search-react": patch
---

The filter rail draws ONE control per axis.

A slug can be a choice and a measurement at once — an imported `year` is a
vocabulary in the catalogue and a measured range in the plan — and the panel
drew both: a checkbox group of years and, further down the same rail, a
from/to picker over the same field. Two controls writing one filter, neither
showing what the other did.

`buildRangeGroups` now takes `countedFacets` (the answer's own counted slugs,
`FacetPanelBag.counted`) and drops a range row for an axis that already has a
bucket list. The counted half wins because it is the one with evidence in it:
a number per value, not two ends. `<FacetPanelPane>` and `<FilterChips>` pass
it, so the desktop rail and the phone chip row cannot disagree; both take
`bothAxes` for a surface that genuinely wants the two. A CORE axis (price) is
exempt — the server reserves that slug — and a range the URL constrains keeps
its control whatever else is on the rail.
