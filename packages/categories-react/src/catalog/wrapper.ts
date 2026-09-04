/**
 * THE TRANSPARENT WRAPPER — a single-child level that browsing skips.
 *
 * The browse-stages SPEC's census addendum (2026-09-04): `/c/uslugi` (the
 * "Services" root) has one child, an import-only "Services offer" category,
 * whose own children are the real 34 groups — an IMPORT WRAPPER, a level that
 * exists only because the source catalogue
 * nested a real level under a placeholder one. The rule, restated as code:
 * when a node's own children are exactly ONE row, and that one row itself has
 * children, a tile page draws the GRANDCHILDREN instead of a single tile that
 * points at the wrapper. The tree is unchanged — the wrapper keeps its id,
 * slug and page, and remains a legitimate placement target — this is a
 * BROWSING decision, the same kind `catalog/stage.ts` makes about depth, not
 * a projection of the catalogue.
 *
 * ── One hop, never a walk ───────────────────────────────────────────────────
 *
 * The rule fires exactly once. A wrapper whose own single child is ALSO a
 * wrapper is not chased down to the first branching descendant —
 * {@link browseChildren} calls `grandchildrenOf` on the immediate child and
 * nowhere else. The addendum names one substitution ("the node's tile page
 * shows the grandchildren"), not a walk to the first branching descendant,
 * and a recursive version would let a chain of renamed import levels turn a
 * page's breadcrumb into a guess about which of several skipped names
 * survives. The census that produced the addendum found exactly one such
 * node on the imported tree; chasing further is speculative complexity for a
 * case nobody has shown.
 *
 * ── Detecting a wrapper never costs a fetch ─────────────────────────────────
 *
 * "That one child itself has children" is answered by {@link hasChildren}
 * from `catalog/stage.ts` — the SAME fallback chain a stage check already
 * reads off a row that is already in hand (`tn_children_pks` on a flat
 * `Category`, `children_as` surviving a depth cut on a `CategoryTreeNode`).
 * {@link isTransparentWrapper} never issues a second request just to learn
 * whether the single child qualifies, and a host may call it directly — the
 * wrapper's OWN page redirect the addendum describes ("the wrapper's own page
 * is treated as its parent's") asks the same question from the wrapper's
 * side: is this row its parent's only child, and does it have children of
 * its own?
 *
 * Drawing the grandchildren, unlike detecting them, DOES need their rows.
 * {@link browseChildren} takes `grandchildrenOf` for that reason alone, and
 * it may answer `undefined` — not fetched yet, not "has none" — in which case
 * the page falls back to the ONE wrapper tile rather than rendering nothing,
 * and swaps in the real grandchildren the moment that read lands.
 */
import type { BrowseStageInput } from "./stage.js";
import { hasChildren } from "./stage.js";

/**
 * A child's own children, however the caller's shape carries them.
 *
 * A nested `CategoryTreeNode`/`CategoryNode` answers from its own `children`
 * field (`(child) => child.children`) — nothing to fetch. A flat `Category`
 * row from a `{id}/children/` read carries no nested children at all, so a
 * host on that shape supplies a lookup over whatever it already fetched (or
 * is fetching) for the one candidate wrapper — `undefined` while that read is
 * still in flight or has not been asked for yet.
 */
export type ChildrenOf<C> = (child: C) => readonly C[] | undefined;

/**
 * Is `children` a one-rung import wrapper — exactly one row, itself with
 * children of its own?
 *
 * Structural over {@link BrowseStageInput} (the same shape `browseStage` and
 * `childControl` take), so it reads a `Category`, a `CategoryTreeNode` or a
 * host's own row without a cast. Needs no `grandchildrenOf`: presence is a
 * boolean {@link hasChildren} already answers from fields the row carries,
 * not from a fetch.
 *
 * A single LEAF child is not a wrapper — `false`, because {@link hasChildren}
 * is false for it — and that leaf is exactly the case a tile page must still
 * draw as its one real destination rather than skip.
 */
export function isTransparentWrapper<C extends BrowseStageInput>(
  children: readonly C[]
): boolean {
  if (children.length !== 1) return false;
  const [only] = children;
  return only !== undefined && hasChildren(only);
}

/**
 * The list a tile page should draw for a node's own `children` — the
 * children themselves, or, when {@link isTransparentWrapper} fires, the one
 * child's own children (its GRANDCHILDREN, from the caller's perspective).
 *
 * `grandchildrenOf` answering `undefined` (not loaded yet) falls back to
 * `children` unchanged — the single wrapper tile — rather than an empty
 * page: a page that rendered nothing while the extra read was in flight would
 * flash empty content on every wrapper it draws, for a state that resolves a
 * request later.
 */
export function browseChildren<C extends BrowseStageInput>(
  children: readonly C[],
  grandchildrenOf: ChildrenOf<C>
): readonly C[] {
  if (!isTransparentWrapper(children)) return children;
  const [wrapper] = children;
  if (wrapper === undefined) return children;
  const grandchildren = grandchildrenOf(wrapper);
  return grandchildren ?? children;
}
