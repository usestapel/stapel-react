/**
 * WHERE TILES STOP — the depth rule of the catalogue navigation model.
 *
 * The owner's model has three steps, and only the first two are tiles:
 *
 *   1. the top level of the tree is TILES on the home screen;
 *   2. the children of a top-level category are TILES on that category's
 *      landing;
 *   3. everything deeper is NOT a tile grid and NOT a modal picker — it is
 *      chosen as a CHARACTERISTIC, through cascading child selectors (the
 *      "brand -> model" pattern), both when filtering a result list and when
 *      posting a listing.
 *
 * So the rule this file states is not a layout preference. Below the cap, a
 * category is not a destination a person navigates INTO at all: it is a value
 * they pick in a selector on a screen they are already on. A tile grid there
 * offers a second, competing way to make the same choice, and the two disagree
 * about where the person ends up.
 *
 * ── The cap is on the TILE's depth, not on the landing's ───────────────────
 *
 * That distinction is the whole subtlety, and getting it backwards is an
 * off-by-one that ships silently. A landing draws its CHILDREN, so a category
 * at depth *d* would draw tiles at depth *d + 1*: capping the LANDING at depth
 * 1 would put tiles at depth 2 on screen, which is level 3 of the tree and
 * exactly what step 3 above rules out. The cap therefore names the deepest
 * depth a TILE may have, and the landing rule is derived from it — one number,
 * one direction to read it, and a fleet-wide change is one line.
 *
 * Concretely, with {@link MAX_TILE_DEPTH} at 1:
 *
 *   home screen        draws depth-0 rows   → tiles
 *   /c/<top-level>     draws depth-1 rows   → tiles
 *   /c/<level 2>       would draw depth-2   → NO tile grid
 *   deeper             would draw deeper    → NO tile grid
 *
 * ── Why a constant rather than a check per surface ─────────────────────────
 *
 * Three surfaces need this number: the category landing (whether to draw a
 * subcategory tile grid), the search/filter panel (where the cascading
 * selectors take over from tiles) and the composer (the same handover while
 * posting). Three copies of the arithmetic drift the moment one of them is
 * edited, and the drift is invisible — each surface still looks correct on its
 * own. They read this instead.
 *
 * NOTHING IS DELETED. The deeper tree stays fully built and fully addressable
 * (`catalog/tree.ts`); a category below the cap keeps its own page, its own
 * breadcrumb and its own listings. It is simply not OFFERED as a tile.
 */
import type { CategoryNode } from "./tree.js";

/**
 * The deepest depth a category may be drawn as a TILE at.
 *
 * Depth is the built tree's own 0-indexed depth: a top-level category is
 * depth 0, its child is depth 1. `1` therefore means the home screen's tiles
 * (depth-0 rows) and a top-level category's landing tiles (its depth-1
 * children) — and nothing below, because below that a category is a
 * characteristic chosen in a cascading selector, not a place to navigate to.
 *
 * Exported so the search and composer surfaces read this number instead of
 * inventing their own — see this file's header.
 */
export const MAX_TILE_DEPTH = 1;

/**
 * May the category at this depth offer its CHILDREN as a tile grid?
 *
 * `depth` is the landing category's own depth in the built tree; its children
 * sit one level below, and it is the children that must be within
 * {@link MAX_TILE_DEPTH}. The catalogue ROOT — the home screen, which is above
 * every category — has no depth of its own: pass `null` or `undefined` for it
 * rather than inventing a `-1` at the call site.
 */
export function categoryOffersTileGrid(
  depth: number | null | undefined
): boolean {
  const tileDepth = depth === null || depth === undefined ? 0 : depth + 1;
  return tileDepth <= MAX_TILE_DEPTH;
}

/** {@link categoryOffersTileGrid} for a built node — the form a landing has. */
export function nodeOffersTileGrid(
  node: CategoryNode | null | undefined
): boolean {
  return categoryOffersTileGrid(node?.depth);
}
