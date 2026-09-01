/**
 * WHERE THE CATALOGUE CONTINUES AFTER THE TILES STOP — the ladder of child
 * selectors that `catalog/tiles.ts` promises and nothing built.
 *
 * `MAX_TILE_DEPTH` says the first two levels of the tree are tiles and
 * "everything deeper is chosen as a CHARACTERISTIC, through cascading child
 * selectors (the brand -> model pattern)". That rule was stated, and enforced
 * on the tile side — past the cap a landing draws no grid — but the thing it
 * hands over TO did not exist. The measured result on a live classified
 * deployment is the whole reason this file is here:
 *
 *   catalogue        3583 categories, 3036 of them leaves
 *   within the cap   198 rows, so 94% of the tree had no route to it at all
 *   a level-2 page   `GET {id}/features/` answers `[]` — features are
 *                    resolved by INHERITANCE (own + ancestors), so a category
 *                    whose own rows are empty legitimately has none
 *   its child        59 features, the whole brand/model/generation chain
 *
 * A person reaching the level-2 page was therefore told, truthfully, that the
 * category has no characteristics — one tap above the 59 that make the
 * category usable, with no control on the screen that would take them there.
 * Tiles stopped and nothing started.
 *
 * ── What a cascade IS, stated once ─────────────────────────────────────────
 *
 * A LADDER of levels. Level 0 offers the children of the cascade's root (the
 * catalogue itself, when there is no root); every level below offers the
 * children of the level above's chosen node; the ladder ends at a leaf. It is
 * the same shape a `hierarchical_select` feature has — which is exactly the
 * point, and exactly why the owner's model calls a deep category "a
 * characteristic": to the person, choosing `Cars > New` is the same gesture as
 * choosing `Brand > Model`, and it must not be a second, different one.
 *
 * ── Derived, never accumulated ─────────────────────────────────────────────
 *
 * The ladder is a PURE FUNCTION of (index, root, cursor). There is no
 * per-level state anywhere, and that is the invariant this file exists to
 * hold: a cascade that remembered a chosen node per level would let a level-3
 * answer survive a level-1 change, which is the classic defect of this control
 * — the brand is switched and the previous brand's model is still on screen,
 * still in the query string, matching nothing.
 *
 * Truncation is therefore not an operation. Choosing at level *k* moves the
 * cursor to that node; every level below simply is not built, because the
 * chain from the root to the cursor is one node shorter. Nothing is cleared,
 * so nothing can fail to clear.
 *
 * ── Why this is not `CategoryPicker` ───────────────────────────────────────
 *
 * `headless/CategoryPicker.tsx` is a DRILL-DOWN: one list at a time, replacing
 * itself as you descend, plus a flat search. It answers "find me a category in
 * a tree of three thousand". Its skin is a bottom sheet, because a journey
 * that replaces itself needs somewhere to happen.
 *
 * A cascade answers a different question — "narrow the category I am already
 * in" — and it answers it in place, with every level still visible and every
 * level still changeable. The two coexist: the picker remains for a search
 * across the whole catalogue, and it remains the honest control for a host
 * with no tiles at all. What the cascade replaces is the picker used as a
 * MODAL category chooser on a surface that has already established where the
 * person is, which the owner ruled out by name.
 */
import type { CategoryIndex, CategoryNode } from "./tree.js";

/** One rung of the ladder. */
export interface CategoryCascadeLevel {
  /** 0 for the children of the cascade's root. */
  readonly depth: number;
  /**
   * Whose children this level offers — `null` at the top of a rootless
   * cascade, where the options are the catalogue's roots. It is also the
   * answer to "what does clearing this level go back to".
   */
  readonly parent: CategoryNode | null;
  /** Never empty: a level with no options is not built (see {@link buildCategoryCascade}). */
  readonly options: readonly CategoryNode[];
  /** The option taken at this level, or `null` while the level is unanswered. */
  readonly chosen: CategoryNode | null;
}

export interface BuildCategoryCascadeOptions {
  /**
   * Where the ladder starts. `null`/absent starts at the catalogue's roots —
   * the composer's case, where nothing has been established yet.
   *
   * On a category landing this is the category the TILES arrived at, so the
   * ladder offers only what is below it and the two mechanisms meet at exactly
   * one boundary rather than overlapping.
   *
   * A root that is not in the index (a slug that has not resolved, a row the
   * browse projection filtered out) yields an EMPTY ladder rather than
   * silently falling back to the catalogue root — offering the whole tree
   * where the caller asked for one branch is a wrong answer that looks like a
   * working control.
   */
  readonly rootId?: number | null;
  /**
   * How deep the person has gone. Every ancestor of it between the root and it
   * is answered; the first unanswered level offers its children.
   *
   * Not required to be a descendant of `rootId`: when it is not, the ladder is
   * built as if nothing were chosen, which is what a stale URL parameter
   * against a re-parented catalogue should do.
   */
  readonly cursorId?: number | null;
}

/**
 * The ladder for one (root, cursor) pair.
 *
 * The last level is the FIRST UNANSWERED one — the level whose `chosen` is
 * `null` — and there is at most one of those, because a level is only built
 * once the level above it has an answer. The ladder ends without one when the
 * cursor is a leaf: there is nothing further to ask.
 *
 * A level with no options is never built. That is not a cosmetic rule: a
 * chosen node with no children IS the end of the cascade, and an empty
 * trailing select would ask a question the catalogue has no answers for while
 * making a finished choice look unfinished.
 */
export function buildCategoryCascade(
  index: CategoryIndex,
  options: BuildCategoryCascadeOptions = {}
): readonly CategoryCascadeLevel[] {
  const rootId = options.rootId ?? null;
  const root = rootId === null ? null : (index.byId.get(rootId) ?? null);
  if (rootId !== null && root === null) return [];

  const chain = cascadeChain(index, root, options.cursorId ?? null);

  const levels: CategoryCascadeLevel[] = [];
  let parent: CategoryNode | null = root;
  for (let depth = 0; ; depth += 1) {
    const siblings: readonly CategoryNode[] =
      parent === null ? index.roots : parent.children;
    if (siblings.length === 0) break;
    const chosen = chain[depth] ?? null;
    levels.push({ depth, parent, options: siblings, chosen });
    if (chosen === null) break;
    parent = chosen;
  }
  return levels;
}

/**
 * Root -> cursor, exclusive of the root, or `[]` when the cursor is not below
 * the root.
 *
 * Walks PARENT LINKS in the built tree rather than reading
 * `tn_ancestors_pks`, and the difference is load-bearing: the wire's ancestry
 * is the server's, complete, while this index may legitimately have dropped an
 * inactive or test ancestor. A chain containing a node the index does not hold
 * would build a level whose `chosen` is not among its `options`, which is a
 * select showing a value it cannot show.
 */
function cascadeChain(
  index: CategoryIndex,
  root: CategoryNode | null,
  cursorId: number | null
): readonly CategoryNode[] {
  if (cursorId === null) return [];
  const cursor = index.byId.get(cursorId);
  if (cursor === undefined) return [];

  const chain: CategoryNode[] = [];
  let node: CategoryNode | undefined = cursor;
  // Bounded by the catalogue's depth; the guard is against a cycle a corrupt
  // `tn_parent` could describe, which would otherwise hang the render.
  for (let guard = 0; node !== undefined && guard <= MAX_CASCADE_DEPTH; guard += 1) {
    if (root !== null && node.id === root.id) return chain.reverse();
    chain.push(node);
    const parentId = node.category.tn_parent;
    if (parentId === null || parentId === undefined) {
      // Reached a root of the tree. That is the answer only for a rootless
      // cascade; for a rooted one it means the cursor is somewhere else in
      // the catalogue entirely.
      return root === null ? chain.reverse() : [];
    }
    node = index.byId.get(parentId);
  }
  return [];
}

/** A catalogue deeper than this is a cycle, not a catalogue. */
const MAX_CASCADE_DEPTH = 64;

/**
 * The nodes the ladder has answers for, top first — the trail a skin prints so
 * the person can see where they landed, and pop back up.
 *
 * Derived from the ladder rather than from the cursor, so the trail cannot
 * disagree with the controls beside it.
 */
export function cascadeTrail(
  levels: readonly CategoryCascadeLevel[]
): readonly CategoryNode[] {
  const trail: CategoryNode[] = [];
  for (const level of levels) {
    if (level.chosen !== null) trail.push(level.chosen);
  }
  return trail;
}

/**
 * The deepest answered node, or `null` — what the cascade currently NAMES.
 *
 * `null` for an untouched rooted cascade too: the root is where the person
 * already was, not something the cascade chose for them.
 */
export function cascadeSelection(
  levels: readonly CategoryCascadeLevel[]
): CategoryNode | null {
  const trail = cascadeTrail(levels);
  return trail[trail.length - 1] ?? null;
}

/**
 * Has the cascade reached a category nothing lives under?
 *
 * TRUE only for an answered leaf. An untouched cascade is `false` even when
 * its root is a leaf — the caller asked whether the LADDER finished, and a
 * ladder with no rungs did not.
 *
 * This is the composer's gate: a listing filed under a non-leaf inherits the
 * wrong feature set, so the attribute form waits for this.
 */
export function cascadeReachedLeaf(
  levels: readonly CategoryCascadeLevel[]
): boolean {
  const selection = cascadeSelection(levels);
  return selection !== null && selection.children.length === 0;
}
