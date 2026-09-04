---
"@stapel/categories-react": minor
---

categories: the tile art's three arms each get to decline, the cascade learns the browse contract's commit rule, and the storefront gets back the two slots it was re-implementing

**A tile's art arms may DECLINE.** `renderIcon` was returned whenever the row
carried a reference — including when it returned `null`. So a storefront with
its own glyphs for five roots and `null` for everything else switched the other
two arms off for the whole catalogue: the seeded `catalog_icon` never drew and
neither did the monogram, and every unglyphed tile had an empty art corner,
which reads as a tile that failed to load. The order the README documents is
now the order the code takes: `renderIcon` if it answers, then an address, then
the monogram.

**`resolveIconSrc`** is the new middle arm — `(category) => string | undefined`
— for a host whose CDN needs a lookup rather than a prefix (`product/<sha256>`).
It takes the CATEGORY, so a host keyed by row answers from its own store
instead of copying the catalogue into a fresh `entries` array per render, and
it keeps the library's `<img>`: lazy, 3:2, `contain`, alt text from the tile's
own label. What comes back still goes through `categoryIconSrc`, so a resolver
that hands over a reference or a `data:` URI draws the monogram rather than a
broken image; `undefined` declines and the row's own field answers.
`<CategoryPage>` forwards it to its tiles arm.

**`commit: "stage"` on the cascade** is the composer's rule as the BROWSE
CONTRACT states it, beside `"leaf"`, which states it from the tree alone. The
ladder ends at the category that owns a feed — `browseStage(node) === "feed"`,
a leaf or a `chips` parent — and offers no rung below it. The difference is a
partition: under `"leaf"` a `chips` parent (`Cars`, with `New` and `Used` under
it) is refused and the cascade goes on offering a rung of New / Used, which
presents a FILTER as a level of the tree and leaves the browsing half and the
posting half of the site disagreeing about what a category is. Under `"stage"`
the cascade commits `Cars`, offers nothing below it and fires no request for
it; the partition child is the host's own required select, out of the same
rows. A LEAF deliberately keeps its speculative rung — that empty answer is the
server verifying the leaf, which is what `atLeaf` is made of. New
`blockedReason` value `"has_subcategories"` for the `"stage"` refusal; it takes
the same wording as `not_a_leaf`, because the two rules differ in what they
accept, not in what they tell a person to do. Keyboard and aria unchanged.

**`<CategoryTileGrid layout="wrap">`** is the same tiles with no scroll port:
`repeat(auto-fill, minmax(min(minTileWidth, 100%), 1fr))`, as many per line as
the container allows and nothing off screen — the geometry a desktop landing
needs, and the one a host had to draw itself, tile anatomy and all. `minTileWidth`
defaults to 240px; the `min(…, 100%)` is what stops a container narrower than
one tile from scrolling sideways. The default is unchanged: `"scroll"`, the
reference two-row row with the peeking third column.

**`<CategoryPage heading>`** replaces the page heading's CONTENT — a node, or a
function of `{ category, count }` — and never the heading element. A storefront
whose title is a sentence this pair cannot compose ("Buy a car in Sochi ·
54 364") had to draw its own above the page's, leaving two headings in one
document outline. `count` is the page's sub-category count, the only count this
pair owns.

The `/default` size budget goes 15.25 → 15.5 KB for the three slots (19 B over
the old line), with the reason in the entry's own name.
