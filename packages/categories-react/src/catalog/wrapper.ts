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
 *
 * ── A second, AUTHORED way a level goes invisible ───────────────────────────
 *
 * stapel-categories 0.20.4 adds `children_as: "transparent"`: a catalogue
 * author marks a node directly, rather than this file inferring one from
 * shape. {@link isTransparentNode} reads the flag; {@link browseChildren} now
 * splices out every transparent CHILD it finds among a node's children (not
 * only a lone one), replacing each with its own children, order kept. A leaf
 * cannot be transparent — {@link isTransparentNode} still answers `true` for
 * one (it is a pure field read), but every caller that ACTS on the flag
 * treats a flagged leaf as an ordinary leaf and warns in development.
 */
import type { BrowseStageInput } from "./stage.js";
import { hasChildren } from "./stage.js";
import { parseTreenodePks } from "./pks.js";

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
 * Is `node` an AUTHORED transparent node — `children_as === "transparent"`?
 *
 * A second, independent way a level goes invisible, added by
 * stapel-categories 0.20.4 alongside {@link isTransparentWrapper}'s
 * structural one-child rule. Where a wrapper is *inferred* from shape (one
 * child, itself with children — the catalogue never marked it), a
 * transparent node is *authored*: the reference collapses this level on
 * purpose, whether it has one sibling or several. "Browsing skips this node:
 * its children appear where it would, its own page is its parent's."
 *
 * A LEAF cannot be transparent — there is nothing behind it for browsing to
 * reveal, and a catalogue that authored the flag on a childless row made a
 * mistake a caller must not silently honour. Callers that act on this (see
 * {@link browseChildren}, `browseStage`) treat a flagged leaf as an ordinary
 * leaf and warn in development; this predicate itself stays a pure read and
 * takes no `console` dependency, so `isTransparentNode` alone is safe to call
 * from a render.
 */
export function isTransparentNode<C extends BrowseStageInput>(node: C): boolean {
  return node.children_as === "transparent";
}

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Is this a DEVELOPMENT build — i.e. may this module talk to the console?
 *
 * Asked as "is it dev", never as "is it not production" — the second form
 * fails open: a browser bundle with no `process` shim leaves `NODE_ENV`
 * undefined, `undefined !== "production"` is true, and every production
 * console gets this warning on a flagged leaf. Same rule as
 * `search-react/src/state/facets.ts`'s `inDevelopment`.
 */
function inDevelopment(): boolean {
  const env = typeof process === "undefined" ? undefined : process.env;
  return env?.NODE_ENV === "development" || env?.NODE_ENV === "test";
}

/** `isTransparentNode`, plus the dev-only warning every CALLER that acts on
 * the flag must give for a flagged leaf — one place, so the message and the
 * condition it fires under cannot drift apart between `browseChildren`,
 * `browseStage` and the cascade. */
function isActionableTransparentNode<C extends BrowseStageInput>(node: C): boolean {
  if (!isTransparentNode(node)) return false;
  if (hasChildren(node)) return true;
  if (inDevelopment()) {
    console.warn(
      "[@stapel/categories-react] a category with children_as: \"transparent\" has no children — a leaf cannot be transparent, and the flag is ignored."
    );
  }
  return false;
}

/**
 * The list a tile page should draw for a node's own `children` — with every
 * TRANSPARENT child (structural wrapper or authored `"transparent"`) spliced
 * out and replaced by ITS OWN children, in place, order kept.
 *
 * Unlike the old one-hop-only wrapper rule, this fires for a transparent
 * child sitting AMONG several siblings, not only when it is the lone child —
 * an authored `children_as: "transparent"` collapses a level on purpose
 * regardless of how many siblings it has. The structural
 * {@link isTransparentWrapper} case is still exactly the lone-child shape it
 * always was; it is just one more way a child can qualify for the splice.
 *
 * `grandchildrenOf` answering `undefined` for a given child (not loaded yet)
 * leaves THAT child's own tile in place rather than dropping it — the same
 * "falls back, does not hide" contract the single-wrapper version always
 * kept, now per child instead of for the whole list.
 *
 * Still one hop: a spliced-in grandchild that is itself transparent is not
 * chased further. The addendum names one substitution per transparent node,
 * not a walk to the first branching descendant.
 */
export function browseChildren<C extends BrowseStageInput>(
  children: readonly C[],
  grandchildrenOf: ChildrenOf<C>
): readonly C[] {
  // The one-hop-only lone-wrapper shape stays a single fast path: a lone
  // child is exactly one candidate, and the loop below reaches the identical
  // answer for it — this keeps the historical entry point cheap and its
  // behaviour unchanged when nothing has changed about the row.
  if (children.length === 1) {
    const [only] = children;
    if (only !== undefined && (isTransparentWrapper(children) || isActionableTransparentNode(only))) {
      const grandchildren = grandchildrenOf(only);
      return grandchildren ?? children;
    }
    return children;
  }

  let changed = false;
  const out: C[] = [];
  for (const child of children) {
    if (!isActionableTransparentNode(child)) {
      out.push(child);
      continue;
    }
    const grandchildren = grandchildrenOf(child);
    if (grandchildren === undefined) {
      // Not fetched yet: fall back to this ONE child's own tile, not to the
      // whole list — the sibling rows around it are unaffected.
      out.push(child);
      continue;
    }
    changed = true;
    out.push(...grandchildren);
  }
  return changed ? out : children;
}

/**
 * Is `child` sitting where a transparent step's ancestry slot would be — a
 * structural one-child wrapper, or an AUTHORED `children_as: "transparent"`
 * node?
 *
 * A BREADCRUMB TRAIL never holds a parent's full sibling array the way a tile
 * page's `childRows` does — each ancestor is one fetched row, `id`-path and
 * slug-path alike (`Category` either way, see `catalog/tree.ts`'s
 * `CategoryNode.category`). `tn_children_pks` on that row already carries the
 * COUNT {@link isTransparentWrapper}'s array-length check stands in for, so no
 * second request buys the same answer: `parent` has exactly one child when
 * its own column parses to one id, and {@link isTransparentWrapper} still
 * answers whether that one child (`child`) has children of its own.
 *
 * The AUTHORED check needs no sibling count at all — `children_as` sits on
 * `child` itself, so it fires whether or not `child` is `parent`'s only row.
 * `undefined` `tn_children_pks` (a row shape that never carried the column)
 * only rules out the structural arm; the authored one is still consulted.
 */
export function isWrapperAncestor<C extends BrowseStageInput>(
  parent: C,
  child: C
): boolean {
  if (isActionableTransparentNode(child)) return true;
  if (typeof parent.tn_children_pks !== "string") return false;
  return (
    parseTreenodePks(parent.tn_children_pks).length === 1 &&
    isTransparentWrapper([child])
  );
}
