---
"@stapel/categories-react": minor
---

The catalogue stops offering rows nobody may browse, tiles stop at the second
level, and a query can reach a category.

**The browse projection.** `GET /categories/` is a REVISION-SYNC contract and
is right to keep sending rows a shopper may not see — a consumer that never
received a row again could never learn it went inactive. So the filter belongs
on the consumer. On a live classified deployment the list endpoint answers 187
rows of which 105 are `active: false`, end-to-end leftovers, and every browse
surface offered them. `isBrowsableCategory` / `browsableCategories` /
`ADMIN_VISIBILITY` (`catalog/browse.ts`) are the one predicate the tile grid,
the carousel, the tree walk and the children hook now share: `active`
(absent means active — the flag is optional and defaults true on the model),
`deleted` (a tombstone, deliberately still served), and `is_test` read
defensively off the wire because the pinned schema does not declare it, where
ABSENT means "not a test row". It never pattern-matches slugs: a heuristic
that drops `authz-…` also drops the real category somebody named `winter-2026`,
and a silently deleted branch is a worse failure than a visible test row. The
sync CACHE still ingests every row — only the projection over it filters, or
the next delta breaks.

**Tiles are two levels.** Level 1 on the home screen and a top-level
category's children on its landing; below that a category is a
CHARACTERISTIC, chosen through cascading child selectors when filtering or
posting, not a tile to navigate into. `MAX_TILE_DEPTH` /
`categoryOffersTileGrid` / `nodeOffersTileGrid` (`catalog/tiles.ts`) are that
rule as one exported number, so the search and composer surfaces read the
same one. `<CategoryTileGrid categoryDepth>` renders nothing past the cap —
not an empty state, because nothing is absent: the sub-categories exist and
are offered in a different shape — and it returns before mounting the
carousel bag, so it issues no request it would discard.

**One subcategory list, not two.** `<CategoryPage subcategories>` takes
`"pane" | "tiles" | "none"` and MOUNTS exactly one; the other is absent from
the document rather than hidden. Without it a host wanting tiles had to mount
the grid as well and hide `<CategoryTreePane>` with its own stylesheet, which
a live deployment was doing — the same links rendered twice. `"pane"` stays
the default, so no existing host changes. The page also takes `renderIcon`
and forwards it to the tiles arm, which otherwise could never draw art.
`categoryTileEntry` is the row→tile mapping lifted out of
`<CategoryCarousel>`: it held the only copy of the `carousel_icon` →
`catalog_icon` → `null` fallback order (with `""` read as absent), and a
second copy would have drifted on the one detail that is invisible when wrong.

**A query reaches a category.** `useCategorySearch` /
`rankCategoryMatches` / `<CategorySearchHits>` match a free-text query against
the categories the browse projection has ALREADY loaded — exact name, then
prefix, then substring, case- and diacritic-insensitive, over the localized
label and the slug, capped. No request per keystroke, and nothing the browse
projection hides can be reached through it. It is a list of category links,
not a picker and not a typeahead over the whole tree.
