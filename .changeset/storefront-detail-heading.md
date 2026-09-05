---
"@stapel/listings-react": patch
---

`<ListingDetailPane headingLevel>` — the listing title can be the page's `h1`

The pane drew the title at `h3` unconditionally, which is right inside a page
that already carries its own `h1` and wrong on the route where the pane IS the
page: measured on a live storefront, that document had no `h1` at all and was
working around it with an offscreen heading stacked above the pane. Only the
host knows which of the two it built, so `headingLevel` (`1 | 2 | 3`, default
`3`) lets it say. Byte-compatible for every existing mount.
