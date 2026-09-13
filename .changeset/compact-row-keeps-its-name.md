---
"@stapel/categories-react": patch
---

The compact row keeps its name, and the scroller's column count is a prop

`size="compact"` is a horizontal row, `[caption][art]`, and the art took a flat
32% of it. A storefront running that size at the scroller's default 2.5 columns
on a 390px phone left ~90px of caption, and its two longest single-word root
names ended in an ellipsis INSIDE the word. The name is the only part of a tile
that says where the tap goes, so it is the part that may not be sacrificed.

Two independent answers:

`visibleColumns` (default 2.5, so no existing host moves) lets a deployment say
how many columns of the scroller are in view. The right number depends on the
longest NAME in the catalogue, which is a fact about the deployment rather than
about the pair.

And the compact row now gives its picture up to its name once it is narrow:
the caption is `flex: 1 1 auto` with `min-width: 0` — so the art is what
yields rather than what is subtracted first — and below 200px of TILE width the
art drops to a 24px corner glyph. A container query and not a media query,
because the same mount is a wide sidebar in one host and a phone strip in
another, and only the tile knows which it ended up as.
