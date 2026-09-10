---
"@stapel/categories-react": minor
---

The flat tile is a stack, and the tile stage reserves the rows it draws.

Both from the owner's read of 0.27.0 on the stand, in both themes.

**The flat tile's own anatomy.** Taking the fill away was half the change. The
card anatomy puts the caption in the top-left corner and the art in the
bottom-right, and the filled box was what held those two marks together: with
no fill they are two unrelated things with a void between them, and six of them
across a desktop row read as a loose list rather than a grid of tiles.
`tileSurface="flat"` now draws the arrangement the phone landing already reads
correctly without a fill — the icon centred with the caption centred under it,
so proximity does what the box used to. The caption keeps the card's own type
size (not the ~80px dense tile's 12px) and its clamp still answers
`labelLines`. The RATIO, the padding and the hover fill are unchanged, so a
flat tile occupies exactly the box a card tile did and no reservation, track
height or measured stage moves. `tileSurface="card"` keeps the corners.
`size="compact"` keeps its own horizontal row (name left, small picture right,
already adjacent) as ruled on 2026-09-04.

**`tileStageRows(count, columns)` and `<CategoryTileGrid reserveCount>`.** Six
tiles in five columns is two rows; five in five is one. The reservation drew a
fixed four skeletons whatever was coming, and the scroller declared its two
rows even with one tile in them — so the stage stood taller than its content
and left an empty band under the last row before the next block (~100px on the
storefront's `/c/transport` desktop). The reservation is now one skeleton per
tile, in the same grid the tiles land in, so the browser lays out exactly
`tileStageRows(count, columns)` rows for the reserve as it will for the answer
— no second copy of the geometry to drift. The scroller declares
`min(2, count)` rows. `reserveCount` defaults to 4, this arm's own long-standing
number, so a caller that says nothing is unchanged; the rule itself is exported
because a host holding the stage's box from outside this pair had nothing to
ask and was guessing a pixel height.

The `default` size budget holds at 19 KB (18652 → 18797 B, dependencies held
constant), recorded in the entry's own note.
