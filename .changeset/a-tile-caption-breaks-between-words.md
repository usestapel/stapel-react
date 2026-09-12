---
"@stapel/categories-react": patch
---

`<CategoryTileGrid>`: a tile caption breaks between WORDS, never inside one.

The compact scroller's column was a pure fraction of the port, which on a 390px
phone is 63px — narrower than the catalogue's longest root names, so
`overflow-wrap: anywhere` split them mid-word with nothing marking the break
and the reader had to reassemble the word before deciding whether to tap it.

The column was the defect, so the column is what changed: `clamp(96px,
calc(100% / 4.4 - gap), 128px)` puts a FLOOR under the fraction — the measure a
twelve-letter root name needs at the caption's type size — and the compact tile
spends one step less inline padding, which gives the caption 88px. Below the
floor the grid gives up a column rather than a word; above it the fraction and
the 128px cap are untouched, so every wider container is exactly what it was.

With the room to be right, the caption is `overflow-wrap: normal` with
`text-overflow: ellipsis` as the floor under a name no column can hold, and its
type size is read from the design system's scale (`xs`) rather than written as
a number.
