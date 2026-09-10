---
"@stapel/categories-react": minor
---

A tile is an icon and a name, and one token spaces every block on a catalogue
page.

**`<CategoryTileGrid tileSurface>`** — default `"flat"`. `surface-sunken` behind
every tile was inherited from the first carousel strip and never re-decided: a
dozen of them on a landing read as a wall of filled boxes, each one competing
with the picture it contains, and the fills carry no information. `"flat"` draws
no fill and no border at rest and takes the surface back on `:hover` and on
`:focus-visible` — the same token fill and the same radius the card tile wears,
so the hovered tile is the tile the grid was already laid out for, and pointing
at a tile is what colours it in. The keyboard focus ring is untouched. Both
themes, through `--stapel-*` custom properties rather than a computed colour that
would freeze whichever theme mounted first. `tileSurface="card"` restores today's
filled tile exactly, and `<CategoryPage subcategoryTileSurface>` reaches the
`"tiles"` arm with it. `CATEGORY_TILE_FLAT_CLASS` and `categoryTileCss()` are
exported for a host drawing its own tiles.

`<CategoryLink>` now forwards `className`, which core's `LinkComponentProps`
already carried — a host router's own `<Link>` receives it unchanged.

**`<CategoryPage blockRhythm>` / `<CatalogPage blockRhythm>`** — default
`"token"`. The distance between two blocks was `spacing[4]` written inline on
whichever `<Flex>` wrapped them: 16px is a form's field spacing, not a page's
section spacing. Every gap now comes from ONE pair of custom properties,
declared as a usage and not as a definition — `var(--stapel-block-gap, 32px)`,
and `var(--stapel-block-gap-compact, 24px)` on a coarse pointer or under the
tablet edge — with each direct block's outer margin reset in the same rule set.
`@stapel/search-react` declares the SAME two property names, so a storefront that
assembles a category screen out of both pairs tunes it with one declaration.
`blockRhythm="legacy"` restores the flat inline gap.

Both defaults are the NEW behaviour on purpose: neither the tile's fill nor the
16px gap was a design anybody chose for these surfaces.

The `default` size budget goes 18.5 → 19 KB, measured and written down in the
entry's own note (18209 → 18652 B with dependencies held constant), rather than
left as a red for somebody to rerun.
