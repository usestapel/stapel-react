---
"@stapel/categories-react": minor
---

`<CategoryTileGrid density>` — the owner's ruling on tile size. The reference
two-row scroller ("cozy", still the default) sizes its column as a fraction
of the container, which read as huge tiles at 390px and inflated to a wall of
~550px tiles inside a wide desktop column. `"compact"` is the dense strip:
4.4 visible columns AND an absolute 128px cap on the column, so the same
mount is small on a phone and a modest strip — never a wall — at any width.
Compact tiles keep the aspect, the art corner, the monogram and the
three-line hyphenating label, at a smaller size and padding.
`<CategoryPage subcategoryTileDensity>` passes the same choice through to the
tiles arm. `TileDensity` is exported. The skin bundle budget moves 13 KB →
13.25 KB for it.
