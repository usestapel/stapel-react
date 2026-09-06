---
"@stapel/search-react": minor
---

search: the rail is drawn ONCE, in the shape the schema gives it (p41)

A plain cold load of `/c/transport-avtomobili` at 1440 read **0.0586 CLS** with
`facet-group-make` moving 152px and `facet-group-model` 76px, `search-results`
among the sources, on four storefront heads across 0.33.1 and 0.34.0. Every
other route is ≤0.006 and a partition press is 0.005 — which is the reading
0.34.0 was cut for, and it is why nothing in 0.34.0 touches this one:
`FacetPanelBag.refreshing` is never `true` on a first load, so the floor each
group stands on while an answer is in flight **does not exist in the one pass a
cold load is made of**.

**What moves the rail is not a late answer, it is a late SCHEMA.** On a
category page the feature list is a separate read from the search — a different
service, a different arrival time — and `categoryFeatures: undefined` says two
different things: "this category hangs no schema" and "the read has not
answered yet". The panel cannot tell them apart, so it draws the rail the
moment the answer lands, with no schema, and draws it AGAIN when the schema
arrives. Both halves of a group's geometry are functions of that schema.
Measured here against the live cars answer, same envelope, schema on and off:

| axis | no schema | schema |
| --- | --- | --- |
| `make_ref_select` | checkbox, 3 rows | **dictionary** — one field |
| `model` | checkbox, 3 rows | **dictionary** — one field |
| `accident`, `color` | checkbox rows | **segmented** pills |
| the order | evidence | schema-required first |

Three shapes and two orders, one frame apart, on every cold load. Three parts
close it, and the first is the one the reading is about:

- **`<SearchPage categoryFeaturesPending>` / `<FacetPanelPane
  categoryFeaturesPending>`** — the third state `categoryFeatures` never had. A
  host passes its schema query's own pending flag; the panel then keeps the box
  it *already* reserves for a load in flight (`data-facets-schema="pending"` on
  the rail) instead of drawing a rail it is about to re-shape and re-order.
  Default `false`: a surface that never had a schema to wait for is byte-for-byte
  unchanged.
- **every group stands on a DECLARED box from the frame it mounts in** —
  `facetGroupReservedHeight` states a height per SHAPE (a dictionary's closed
  face is one field however many values the vocabulary holds; a checkbox group
  is one line per shown row; a segmented group is a wrapping row of pills), and
  it is deliberately a shade under what the skin draws, because the reservation
  is a `min-block-size` floor: under is invisible, over is a hole nothing fills.
  The measured height 0.34.0 introduced is still preferred, and still only
  while an answer is in flight — `data-reserved-source` says which of the two a
  box is standing on.
- **`<SearchPage filtersHeaderReserve>`** — the host's own band above the rail,
  in flow from the first frame. A category page's partition row is two chained
  catalogue reads behind the search answer, so it used to drop in over groups
  that were already drawn; with a declared height the row lands INTO its box.
  The pair never guesses the number: the height of a control it does not own is
  not the pair's to know.

A storefront closes p41 by passing the flag it already has — its features
query's `isPending` — beside the `categoryFeatures` it already passes.
