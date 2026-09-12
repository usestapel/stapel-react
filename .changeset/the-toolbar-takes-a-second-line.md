---
"@stapel/search-react": patch
---

`<SearchResultsPane>`: the results toolbar takes a SECOND line instead of
leaving the viewport, and the count holds its own.

Two readings from a six-width walk of a client storefront. At 768 the count
rendered one GLYPH per line: it sits in the elastic half of the toolbar, was
handed less width than one of its own words, and wrapped like prose. It is now
`white-space: nowrap` with an ellipsis — a short phrase holds its line.

At 360 the sort select ran off the right edge of the screen and was cut
mid-word: the row was `flex-wrap: nowrap` with a scroll port, and a scroll port
with nothing on screen to advertise it is not an affordance. The row wraps now,
with the controls group taking the trailing edge of whichever line it lands on
(`margin-inline-start: auto`) and folding its own controls rather than being
cut. The pinned bar's height is still a constant: the leading half has a ZERO
basis, so the count arriving one render later cannot break the line — only the
controls group can, and it is on the glass from the first frame. `overflow-x`
stays as the last resort under a group too wide even to fold.
