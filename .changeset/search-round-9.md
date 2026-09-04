---
"@stapel/search-react": patch
---

The rail's attribute-range block reserves its box before the answer fills it.

Desktop pass 13 measured a category feed page at 1536px: the last layout
shift on the page (CLS 0.054, over the 0.05 target) was a 53px jump inside
the rail the instant `search-ranges-attributes` — the schema's own numeric
axes, year, mileage, whatever the category declares — arrived, because
nothing had reserved its height beforehand.

`<FacetPanelPane>` now reserves that box from the first paint: with the
category schema already in hand it draws one skeleton row
(`<RangeRowSkeleton>`, `RangeFilterRow.tsx`) per range axis the schema
declares, each `RANGE_ROW_MIN_HEIGHT` tall like the real `<RangeFilterRow>`
it becomes once the query answer lands, so swapping skeleton for real rows
costs no further height; without the schema yet (`categoryFeatures` itself
unresolved) it reserves one row's floor as
`search-ranges-attributes-reserve`, a guess rather than nothing.
