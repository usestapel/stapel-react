---
"@stapel/categories-react": minor
"@stapel/search-react": minor
"@stapel/shell-react": minor
---

A phone can reach any leaf, filter by anything the category declares, and get home.

**`categories-react` — the rootless cascade stops reading the whole catalogue.**
With no `rootId` and no host-supplied `roots`, the top rung was the category
LIST endpoint, which has no roots filter: on a live catalogue of 3583 rows that
was 36 requests, 1.4 MB, and 19.9 seconds before the composer's first select
existed. Every rung below it costs one `children/` call and a third of a
second, so the whole cost of the control was that one question. It is now
answered by `GET /categories/carousel/` — one cached request — projected to the
rows with no ancestors, which is what a root is. A deployment whose carousel
names no roots falls through to the catalogue sync, unchanged.

**`search-react` — an uncounted facet is still a filter.**
A facet's options came only from the counted buckets, so a slug in
`facet_meta.skipped` had none, and every surface drops a group with no options.
On a live cars leaf that meant 26 facetable features declared, 12 counted, and
14 filters a person could read about in a warning and not use — while `/query`
accepts `f.<slug>` for every one of them. `buildFacetGroups` now builds an
uncounted facet's options from the category schema (`config.options`, or the
answer's own captions), with `count: null` beside each — "nobody counted this"
is still said, and it no longer decides whether the filter exists. An applied
value always renders. A `ref_select` whose config is a bare vocabulary pointer
still has no options here and is still not invented.

**`search-react` — the skipped-slug notice is opt-in.**
`FacetPanelPane`/`SearchPage` take `skippedNotice` (default `false`). The
sentence is the engine's own note about its facet plan; on the live cars leaf
it rendered as a yellow warning naming forty-two of the category's fields above
the filters. Same class as the synonym-expansion notice this pair removed
earlier. `skippedNotice` puts it back for a developer.

**`shell-react` — a phone has a way home.**
`phoneChrome="dock"` draws no wordmark (a 390px row cannot hold one and a
search field), and that left `/` reachable from nowhere: the header's leading
control is the host's history back arrow, and the dock's tabs are wherever the
nav manifest points. The header now carries a home MARK — the brand's logo at
glyph size, or a house where there is none — always a link to `/`, at the head
of the row. `home={false}` for a host whose own chrome owns that corner.
`HomeOutlined` joins the nav-icon registry, so a manifest may declare a home
destination without drawing the fallback square.
