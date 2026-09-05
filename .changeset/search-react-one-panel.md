---
"@stapel/search-react": minor
---

One panel, and every axis in it has a name — regenerated against stapel-search 0.16.0.

**The contract.** `facet_meta.ranges` is no longer two numbers per slug: each
entry is a `RangeAxis` carrying `label` + `label_translatable` (resolved from
the same feature definition a group heading comes from, or this library's own
key for a core axis), an optional `unit` (the definition's `postfix`, or a
convertible family's BASE unit — the one a client cannot derive), and `order`.
`facet_meta.withheld[]` is a `WithheldAxis`: every row now names `axis`
(`group`/`range`) and `reason` (`coverage`/`unlabelled`). `facet_labels[<slug>]`
gains `order` on the SAME scale, which is what makes a single panel order
possible at all.

- `buildRangeGroups` captions a row from the answer first, the schema second,
  and **never from the slug**: an axis nobody named is dropped rather than
  drawn as `doors` or `kilometrage` over a from/to picker — the exact chip row
  a live board shipped. The one exemption is a slug the URL constrains, which
  always keeps the control that removes it. It also takes `withheld` and does
  not resurrect from the category schema an axis the answer declined to offer.
  `RangeGroup` gains `order` and `named`.
- **Groups and ranges are drawn as one sequence** (`orderPanelItems`, new).
  Pinned slugs first — `pinnedFacets` now reaches both halves, so a host's
  `partition → make → price → year` holds — then everything the plan numbered,
  then the band order the rail always had (core ranges, groups, measurements)
  for anything nobody numbered. `FacetGroup` gains `order`.
- **An empty facet group draws nothing**, not a heading over an empty box
  (`facetGroupIsEmptyHeading`, new). A dictionary axis is the exemption: its
  control is a field over a vocabulary the answer never enumerated.
- **One «Apply» per panel**, not one per row. `RangeFilterRow` takes `onDraft`
  and `onCommit` and reports its draft instead of owning a button; the panel
  collects and commits them in ONE state change through the new
  `SearchStateBag.setRanges` / `FacetPanelBag.setRanges` (`setRange` twice in a
  tick applied the second axis and silently dropped the first).
- `<SearchPage categoryFilter={false}>` (and `<FacetPanelPane categoryFilter>`)
  removes the «Category» pane entirely — no cascade, no placeholder, and no
  raw-id fallback printing `32/149/163` at a shopper on a page whose category
  the reader walked a tree to reach.
- `<SearchPage resultsLead>` / `<SearchResultsPane lead>`: a slot inside the
  RESULTS column, above the toolbar. `resultsHeader` spans both columns and
  put a category's own words over the filter rail too.
- `<PopularValues columns="responsive">`: a CSS container query climbs a
  1/2/3/4 column ladder by the width of the BLOCK rather than of the window —
  the block sits in the results column, i.e. the window minus a 280px rail.
- `<SortSelect>` annotates a blocked option **at every width**. The reason was
  on the row in the compact arm only; elsewhere it was a line beside the closed
  control, which the open dropdown covers.
- **The loading arm covers the whole pane.** The numeric band and its
  reservation were siblings of it, rendered at positions nothing had decided
  and then travelled to their real places when the plan landed — 0.34 CLS on a
  live host. Nothing renders after the skeleton until there is an order to
  render in.
