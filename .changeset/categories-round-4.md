---
"@stapel/categories-react": minor
---

categories: the first row of tiles stops waiting on a scrollbar, and a category with a handful of children can fill the row instead of sitting in a scroller-shaped corner

**`<CategoryTileGrid eagerCount>`** (default 8) marks that many of the leading
tiles' pictures `loading="eager"` with `fetchPriority="high"` instead of
`loading="lazy"`. Every tile used to be lazy regardless of position, so a
whole first row sitting above the fold on the day it renders gave the browser
no reason to fetch any of it before first paint — a walker measured a home
page's feed shoved 224px down as the row settled a beat late. The "All" tile
never spends a slot: it never carries a picture. Past `eagerCount` a tile
stays lazy, which still matters for `layout="wrap"` or a long mega-menu.

The art corner now reserves its own shape independently of what ends up
inside it: the box around a tile's picture, or its monogram when there is no
picture, is a fixed percentage of the tile at a fixed aspect ratio rather than
a shrink-to-fit cap around whatever content happens to be there. A tile's own
height was already fixed by its 4:3 ratio against a definite grid column; the
art corner no longer has a separate, content-dependent size underneath that.

**`<CategoryPage subcategoryLayout>`** and **`subcategoryMinTileWidth`** reach
`<CategoryTileGrid>`'s `layout` and `minTileWidth` from the `"tiles"` arm. A
category with five children in a wide desktop column read as an empty corner
under the reference scroller — `subcategoryLayout="wrap"` is the fix, the same
tiles stretched to fill the row instead. Both default unchanged (`"scroll"`,
the grid's own `minTileWidth`), so no existing host changes shape.

The `/default` size budget stays inside the existing 15.5 KB line.
