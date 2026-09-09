---
"@stapel/categories-react": minor
---

The phone landing's tiles: a caption break a reader can see, and a pictogram on the "All" tile.

`labelHyphens` is a new prop on `<CategoryTileGrid>` (default `"manual"` — no
existing host changes). A 390px walk measured the compact tile's caption column
at ~63px and a twelve-letter root name at ~83px in it: some break is forced, and
the skin printed no hyphen at it, so a one-word name arrived as two unrelated
fragments. D90 measured the opposite catalogue and its ruling stays the default;
`"auto"` is how a deployment that measured this one asks for the mark, and the
caption is stamped with the i18n engine's locale when it does — `hyphens: auto`
without a language is inert, which is the half that fails silently.
`overflow-wrap: anywhere` is unchanged under both, so a name with no hyphenation
point in it still breaks rather than clipping.

The grid's own "All" tile draws a four-cell pictogram instead of
`<TileMonogram>`. It stands first among ten siblings that all draw a picture, so
a lone faint capital there read as an image that had failed to load. It is the
grid's own control and has no `catalog_icon` to wait for; the monogram is
untouched as what a CATALOGUE ROW falls back to when its art has not been
uploaded.
