---
"@stapel/categories-react": patch
---

Every category link carries its row's ID as `data-category-id`.

`/c/:slug` has no server-side lookup — `stapel-categories` never overrides
`lookup_field` and its list takes no `slug` filter — so a cold slug costs the
whole catalogue (36 requests, 1.4 MB, 23.4 s on a live 3583-row deployment)
while the id costs two small reads. Every link this pair draws already KNOWS
the id, because it drew the row; the tiles, the tree pane, the carousel, the
breadcrumbs and the search hits now pass it through the link seam so a router
host can carry it into the destination (`<Link state>`, a cache seed) and mount
`<CategoryPage categoryId>` instead of `slug`.

A `data-*` attribute rather than a new field on core's `LinkComponentProps`:
that contract already has the `data-${string}` index signature, so this reaches
a host component that spreads its rest props and changes no shared type.
