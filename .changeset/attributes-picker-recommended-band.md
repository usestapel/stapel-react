---
"@stapel/attributes-react": minor
---

A reference picker draws the server's popular band.

A live stand's phone catalogue holds 529 vendors, and the `ref_select` sheet
opened on `3Q, 4Good, 8848, A1, Aceline, Acer` — the only order this side could
produce. `stapel-vocabularies` 0.2.0 gives the level a band and publishes where
it ends; this is the rendering half. The fields read, both exactly as that
release names them:

- **`band: "popular" | "all"` on each term row** — carried on `VocabularyTerm`.
- **`popular_count` on the page** — how many LEADING rows of `results` are in
  the band.

`VocabularyClient.search` may now answer with the endpoint's page
(`{results, popular_count?, total?}`) as well as a bare array. The page shape
exists for the one fact a row cannot carry, and a client that keeps returning
an array keeps working — it draws one plain list.

**The count is the authority; the rows' own tag is only a fallback.** Under a
`q` search the server ranks by prefix FIRST and the band second, so a page can
legitimately read `[popular+prefix, all+prefix, popular, all]` — two rows
tagged `popular` of which only the first leads. Splitting on the tag would lift
the third row over the second and destroy the typeahead ranking, which is why
the endpoint publishes a count and tells clients not to scan. The split is a
SLICE at `popular_count`; neither band's order is this package's opinion. When
no count is given (an array answer, a service older than 0.2.0) the fallback is
the leading run of `band === "popular"` — the server's own algorithm, whose
worst case is a run of zero and therefore one plain list. It can under-report a
band; it can never reorder one.

What it draws:

- **a band** → the popular rows first under their own heading, a rule, then the
  rest of the level under a heading of its own;
- **no band** (`popular_count: 0` — a level nobody has ranked, a page past the
  boundary, or a search whose top hit is a plain prefix match) → exactly what
  it drew before: one plain list, no heading, no rule;
- **search** re-reads the boundary from each response, so a query that keeps
  the band keeps the two-band shape and one that does not collapses back to the
  plain list. A band with nothing in it is never emitted, so no heading can
  stand over nothing;
- **paging** extends the band by a later page's leading run rather than
  restarting it, so a host on a small `limit` that pages THROUGH the boundary
  does not drop the tail of the band under "All options".

The bands are the picker sheet's own groups — headings are never focusable or
pickable, and arrow-key traversal crosses the rule unchanged.

New on the main entry: `termPageOf` (normalize an answer to rows + boundary),
`splitPopularBand`, `isPopularTerm`, and the `VocabularyTermPage` /
`VocabularyTermAnswer` types. New copy in all three catalogues:
`attributes.picker.recommended`, `attributes.picker.all_options` — the heading
reads "Recommended" while the wire calls the band `popular`, deliberately: the
key names a sentence a person reads, and "Popular" is a claim about other
people's behaviour this package cannot substantiate at the point of rendering.
