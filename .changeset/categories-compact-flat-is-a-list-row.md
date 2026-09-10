---
"@stapel/categories-react": minor
---

A compact tile without a fill is a list row.

Architect's verdict, superseding the owner's 2026-09-04 ruling **for the flat
surface only**.

`size="compact"` is the reference's second-level tile: a horizontal row half
the root tile's height. Its 2026-09-04 anatomy puts the name against one end of
that row and the picture against the other — which is a CARD's arrangement, for
exactly the reason the regular tile's opposite corners were one. The filled box
is what makes two marks at opposite ends read as one thing. With the fill gone
(the owner's ruling for every tile) the same row is two pieces of scattered
text with a gap in the middle, which is what the stand measured.

So `size="compact"` + `tileSurface="flat"` is now a list row: **the art first,
the caption second, adjacent, both against the leading edge**, with the design
system's own gap between them and the caption still reading from that edge. It
is the same fix the regular flat tile received, applied along the axis this
anatomy actually runs in — proximity replacing the box.

Height, density and padding are the 2026-09-04 ruling either way; only the
arrangement inside the row moves. `size="compact"` + `tileSurface="card"` keeps
that ruling exactly, opposite ends and all, and `size="regular"` + `flat` is
untouched — it stays the centred stack.

No new prop: this is the flat surface drawing correctly at both sizes. The
`default` size budget holds at 19 KB (18797 → 18846 B, dependencies held
constant), recorded in the entry's own note — 154 B of room left, and the next
change to that entry spends them.
