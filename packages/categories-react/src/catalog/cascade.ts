/**
 * WHERE THE TILES STOP — the ladder of child selectors `catalog/tiles.ts`
 * promises, and the one surface in this pair that walks the tree WITHOUT
 * transferring it.
 *
 * `MAX_TILE_DEPTH` caps tiles at the second level of the tree, on the rule that
 * everything deeper is chosen as a CHARACTERISTIC through cascading child
 * selectors. The cap was enforced and the selector did not exist, so on a live
 * classified catalogue the measured result was total:
 *
 *   catalogue        3583 categories, 3036 of them leaves
 *   within the cap   198 rows — 94% of the tree had no route to it
 *   a level-2 page   `GET {id}/features/` → `[]`
 *   its child        59 features, the whole brand/model chain
 *
 * Features resolve by INHERITANCE (own plus every ancestor's), so a category
 * whose own rows are empty legitimately has none: the level-2 page told a
 * person the truth, one tap above the 59 that make the category usable.
 *
 * ── Why this file holds ids and rows, and not the built tree ───────────────
 *
 * Because the built tree costs 1.4 MB and twenty seconds, and one rung of the
 * ladder costs four kilobytes and a third of a second. Measured on that same
 * deployment:
 *
 *   whole catalogue, `?page_size=100`    36 requests   1453 KB   20.2 s
 *   whole catalogue, `?page_size=1000`    4 requests   1447 KB   10.4 s
 *   whole catalogue, `data.json`          1 request    1411 KB    8.5 s
 *   ONE level, `GET {id}/children/`       1 request    1-4 KB   0.25-0.39 s
 *
 * Every protocol that reads the whole table is within a factor of two of every
 * other, because the table IS the cost — so the fix is not a better sync, it
 * is not syncing. A cascade asks for exactly the level it is drawing.
 *
 * That is why the functions here take ROWS (`Category`, straight off
 * `{id}/children/`) rather than a `CategoryIndex`: an index can only be built
 * from the whole catalogue, and needing one is the same as needing all of it.
 *
 * ── Derived, never accumulated ─────────────────────────────────────────────
 *
 * The ladder is a pure function of (fetched levels, chain of chosen ids).
 * There is no per-level state, and that is the invariant this file exists to
 * hold: a cascade that remembered a chosen node per level would let a level-3
 * answer survive a level-1 change — the classic defect of this control, where
 * the brand is switched and the previous brand's model is still on screen and
 * still in the query string, matching nothing.
 *
 * Truncation is therefore not an operation. Choosing at level *k* shortens the
 * chain; every level below is simply not built, and its request is not made.
 *
 * ── Why this is not `CategoryPicker` ───────────────────────────────────────
 *
 * `headless/CategoryPicker.tsx` is a DRILL-DOWN over the synced tree: one list
 * at a time, replacing itself as you descend, plus a flat search across the
 * whole catalogue. It answers "find me a category among three thousand", and
 * that question genuinely needs the catalogue — which is exactly why opening
 * it cost twenty seconds on this deployment.
 *
 * A cascade answers a different question — "narrow the category I am already
 * in" — in place, with every level still visible and still changeable. What it
 * replaces is the picker used as a MODAL category chooser on a surface that
 * has already established where the person is, which the owner ruled out by
 * name and which is also the surface where the twenty seconds were being paid.
 */
import type { Category } from "../api/types.js";
import { parseTreenodePks } from "./pks.js";

/** One fetched rung: whose children these are, and what they are. */
export interface CategoryCascadeSource {
  /** `null` at the top of a rootless ladder, where the options are roots. */
  readonly parentId: number | null;
  /** The parent's own row, when it is known — a skin labels the rung with it. */
  readonly parent: Category | null;
  readonly options: readonly Category[];
}

/** One rung of the ladder, resolved. */
export interface CategoryCascadeLevel {
  /** 0 for the children of the cascade's root. */
  readonly depth: number;
  readonly parentId: number | null;
  readonly parent: Category | null;
  /** Never empty: a rung with no options is not built (see {@link buildCategoryCascade}). */
  readonly options: readonly Category[];
  /** The option taken at this rung, or `null` while it is unanswered. */
  readonly chosen: Category | null;
}

/**
 * The chain of chosen ids, top-down, from just below `rootId` to `cursorId`.
 *
 * `ancestors` is the cursor's own `tn_ancestors_pks`, parsed — the SERVER's
 * ancestry, which is the only complete one available without the tree.
 * A cursor that is not below the root yields `[]`, which is what a stale URL
 * parameter against a re-parented catalogue should do.
 */
export function cascadeChainIds(
  ancestors: readonly number[],
  cursorId: number | null,
  rootId: number | null
): readonly number[] {
  if (cursorId === null) return [];
  const full = [...ancestors, cursorId];
  if (rootId === null) return full;
  const at = full.indexOf(rootId);
  // The root must be an ANCESTOR, not the cursor itself: a cursor equal to the
  // root means the ladder has not been started.
  if (at < 0 || at === full.length - 1) return [];
  return full.slice(at + 1);
}

/**
 * Which parents the ladder needs the children of, top-down.
 *
 * `[root, ...answered]` — one entry per rung that could exist. The LAST entry
 * is speculative: its request is what discovers whether the deepest answer is
 * a leaf, and an empty answer is how the ladder learns to stop.
 */
export function cascadeParentIds(
  rootId: number | null,
  chainIds: readonly number[]
): readonly (number | null)[] {
  return [rootId, ...chainIds];
}

/**
 * Assemble the fetched rungs into the ladder.
 *
 * A rung with no options is never built. That is not cosmetic: a chosen
 * category with no children IS the end of the cascade, and an empty trailing
 * select would ask a question the catalogue has no answers for while making a
 * finished choice look unfinished.
 *
 * Building stops after the first UNANSWERED rung — there is at most one, and
 * nothing below it is a question yet.
 */
export function buildCategoryCascade(
  sources: readonly CategoryCascadeSource[],
  chainIds: readonly number[]
): readonly CategoryCascadeLevel[] {
  const levels: CategoryCascadeLevel[] = [];
  for (let depth = 0; depth < sources.length; depth += 1) {
    const source = sources[depth];
    if (source === undefined || source.options.length === 0) break;
    const wanted = chainIds[depth];
    const chosen =
      wanted === undefined
        ? null
        : (source.options.find((row) => row.id === wanted) ?? null);
    levels.push({
      depth,
      parentId: source.parentId,
      parent: source.parent,
      options: source.options,
      chosen,
    });
    if (chosen === null) break;
  }
  return levels;
}

/**
 * The rows the ladder has answers for, top first — the trail a skin prints so
 * a person can see where they landed and pop back up.
 *
 * Derived from the ladder rather than from the cursor, so the trail cannot
 * disagree with the controls beside it.
 */
export function cascadeTrail(
  levels: readonly CategoryCascadeLevel[]
): readonly Category[] {
  const trail: Category[] = [];
  for (const level of levels) {
    if (level.chosen !== null) trail.push(level.chosen);
  }
  return trail;
}

/**
 * The deepest answered row, or `null` — what the cascade currently NAMES.
 *
 * `null` for an untouched rooted cascade too: the root is where the person
 * already was, not something the cascade chose for them.
 */
export function cascadeSelection(
  levels: readonly CategoryCascadeLevel[]
): Category | null {
  const trail = cascadeTrail(levels);
  return trail[trail.length - 1] ?? null;
}

/**
 * Has the ladder reached a category nothing lives under?
 *
 * The evidence is a rung that was FETCHED AND CAME BACK EMPTY under the
 * deepest answer — the server saying "leaf". Not the absence of a rung, which
 * is the same shape and a different sentence: a rung still in flight has no
 * source either, and reading that as a leaf would let a cascade announce a
 * finished choice a third of a second before it knows whether one exists. On
 * the composer, whose whole gate hangs on this, that is a listing filed one
 * level too high.
 *
 * It is also not `tn_children_pks`: that column is maintained by
 * django-treenode, which knows nothing about `active` or `deleted`, so it
 * names rows the browse projection drops. The request is the only authority.
 *
 * `false` for an untouched ladder even when its root is a leaf: the caller
 * asked whether the LADDER finished, and one with no rungs did not.
 */
export function cascadeReachedLeaf(
  sources: readonly CategoryCascadeSource[],
  chainIds: readonly number[]
): boolean {
  if (chainIds.length === 0) return false;
  // The rung UNDER the deepest answer. Absent = not fetched; empty = leaf.
  const terminal = sources[chainIds.length];
  if (terminal === undefined || terminal.options.length > 0) return false;
  // …and every answer above it is really an option of its own rung, so a
  // stale id in a URL cannot report itself as a finished choice.
  return chainIds.every(
    (id, depth) =>
      sources[depth]?.options.some((row) => row.id === id) === true
  );
}

/** `tn_ancestors_pks` of one row, parsed — the server's own chain. */
export function categoryAncestorChain(
  category: Category | null | undefined
): readonly number[] {
  return category === null || category === undefined
    ? []
    : parseTreenodePks(category.tn_ancestors_pks);
}
