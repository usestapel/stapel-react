---
"@stapel/categories-react": minor
---

Two additions, one round.

**An authored transparent node, alongside the structural wrapper.**
stapel-categories 0.20.4 adds `children_as: "transparent"`: a catalogue
author marks a level that browsing skips deliberately — its children appear
where it would, its own page is its parent's — whether or not it has
siblings. `isTransparentNode` reads the flag; `browseChildren` now splices
out **every** transparent child among a node's children, not only a lone
one, replacing each with its own children in place, order kept. The
structural one-child wrapper rule (`isTransparentWrapper`) is unchanged — it
is just one more way a single child can qualify. `browseStage` takes an
optional `parent` argument: a transparent node's own shape is
`browseStage(parent)`, `"feed"` without one — never `"tiles"` for a node
that is not a real destination. `childControl` returns `"none"` for a
transparent node, and `isWrapperAncestor` honours the flag for a breadcrumb
step regardless of sibling count. `<CategoryCascadeField>` collapses a
transparent rung the same way, wherever it sits among a rung's options. A
flagged LEAF is ignored (a leaf cannot be transparent) with a dev-only
console warning — `children_as` is declared here by hand, ahead of the
pinned schema, which still lists only `tiles | chips`.

**The reference's second-level tile, and the «All categories» overflow**
(owner's ruling, 2026-09-04). `<CategoryTileGrid size="compact">` is a third
tile anatomy — a horizontal row, name left, small picture right, about half
the root tile's height for the same width — orthogonal to `density` (the
phone scroller's column count) and `layout` (scroll vs wrap); a root landing
keeps `size="regular"`, unchanged. `maxVisible` + `overflow="modal"` caps the
grid and draws one more tile, «All categories», opening a `SkinDialog` that
lists every child (not only the hidden ones) as compact, real links, with a
search box past 20 rows. `<CategoryPage>`'s `"tiles"` arm takes the same
three knobs as `subcategoryTileSize`, `subcategoryMaxVisible` and
`subcategoryOverflow`. A storefront applies
`size="compact" maxVisible={10} overflow="modal"` on every tile page below
the home.
