---
"@stapel/categories-react": minor
---

A one-rung import wrapper is now invisible to browsing — the census
addendum to the browse-stages contract (2026-09-04): `/c/uslugi` has one
child (an import-only "offer" category) whose own children are the real 34
groups, a level that exists only because the source catalogue nested a real
level under a placeholder one.

New `isTransparentWrapper(children)` (`catalog/wrapper.ts`) is `true` only
for exactly one child that itself has children — a single leaf child, or two
or more children, is never a wrapper. It reads the same fields
`browseStage`/`childControl` already do (`tn_children_pks`, then
`children_as` surviving a depth cut, via the now-exported `hasChildren`), so
detecting a wrapper never costs a request. New `browseChildren(children,
grandchildrenOf)` returns `children` unchanged for anything that is not a
wrapper, the wrapper's own children once `grandchildrenOf` resolves them, or
`children` unchanged (the wrapper's own single tile) while that resolution
is still in flight — never an empty page. The rule fires once: a
wrapper-of-a-wrapper is not chased past its first hop.

`<CategoryPage subcategories="tiles">` wires this itself: its tiles arm
(`TileSubcategories`) detects a wrapper for free off the rows it already
has and, only then, fires one small `useCategoryChildren` read to draw the
wrapper's children as the page's tiles instead of a single tile pointing at
an import level nobody may act on. `useCategoryCascade` (and
`<CategoryCascadeField>` over it) applies the same one-hop merge to
whichever rung a wrapper lands on — fetched eagerly the moment the wrapper
is detected, not only after a click on its otherwise-pointless one-option
select — so `atLeaf`/`trail`/`selected` and the visible rung count all agree
with what the ladder actually shows.

Both new functions are exported from the package root, alongside
`hasChildren` (moved from a `catalog/stage.ts` internal to a shared export
so `catalog/wrapper.ts` reads the same fallback chain rather than a second
copy of it).
