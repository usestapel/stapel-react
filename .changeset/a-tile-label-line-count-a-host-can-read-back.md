---
"@stapel/categories-react": minor
---

**A tile label's line count is a number, not an `!important`.**
`<CategoryTileGrid labelLines>` sets how many lines a tile's label may take
before it is clipped, in whichever of the three anatomies is drawn — the "All"
tile and the `overflow="modal"` tile included. The default is unchanged and
stays per-anatomy (three lines on the regular tile, two on `density="compact"`
and on `size="compact"`, where a small square and a half-height row have no
third line to spend), so no existing host changes shape.

The clamp is the only part of a label that depends on the CATALOGUE's words
rather than on the tile, and it was the one part a host could not reach: it is
an inline style, so a stylesheet needs `!important` to touch it, and the rule
then has to name the label by POSITION. A deployed one named
`span:first-child`, which is the label on the regular tile and the ART on
`density="compact"` — so the override had been clamping nothing on the surface
it was written for, while reading as coverage. `labelLines` moves the clamp and
only the clamp: the type size, the alignment, and the `hyphens: manual` /
`overflow-wrap: anywhere` pair that keep a long caption readable stay the
skin's.

`<CategoryPage subcategoryLabelLines>` reaches the same number from the
`"tiles"` arm, alongside the `subcategoryTileSize` it travels with: the compact
anatomy clamps at two because a half-height row has no third line, and a
catalogue whose section names are longer needs that line without giving up the
anatomy.

**And `<CategoryPage measure>` says `"none"` out loud.** The prop already took
anything CSS `max-width` takes; what it did not say is that removing the cap is
a real answer rather than a very large number. A page mounted inside a shell
whose content column already holds the measure every page of the site shares
gets a SECOND, lower cap from this one — and the lower one wins, so the host's
column silently stops applying to exactly one page. `measure="none"` is that
page saying the measure is not its own, the same sentence `gutter={false}`
makes about the indent. Documented on the prop, in the README, and covered by
its own test; no API change.
