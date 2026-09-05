---
"@stapel/categories-react": patch
---

`<CategoryPage gutter={false}>` — a page inside a shell must not indent itself
twice.

`@stapel/shell-react`'s content box now holds the page gutter
(`--stapel-page-gutter`), and a page adding its own inline padding on top of
it sits further in than the header above and the footer below. `gutter={false}`
drops the INLINE half; the block padding stays either way, because the space
between a shell's header and this page's first line is not the shell's to
decide. Default `true`, so a page mounted straight into a router with nothing
around it is exactly where it was. A prop rather than a context read on
purpose: whether there is a gutter outside is a fact about the composition,
and the composing surface is the only party that knows it.
