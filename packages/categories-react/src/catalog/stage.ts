/**
 * WHICH PAGE A CATEGORY GETS — the browse-stage rule, stated once.
 *
 * `catalog/tiles.ts` answers a question about DEPTH ("how far down may a tile
 * grid go"). This answers the same question a different way, in the terms the
 * browse contract now states it: tiles are exactly TWO levels, full stop.
 *
 *   the home screen        shows the roots as tiles
 *   a root's own page      shows ITS CHILDREN as tiles
 *   every page below that  is a FEED over its whole subtree
 *
 * There is no third tile level and no `children_as` exception at the root: a
 * root's page is tiles even if its own children happen to be a partition,
 * because "tiles are two levels" is unconditional. `children_as` still
 * matters — it decides the SHAPE of the filter a feed page puts at the top of
 * its rail, which is {@link childControl}'s job, not this one's.
 *
 * This supersedes an earlier reading of the contract ("tiles end where the
 * attribute schema begins") that let `children_as: "tiles"` produce a tile
 * grid at any depth. On the imported tree that put tile pages six levels
 * deep, because schemas hang on the leaves — see the browse-stages SPEC's
 * evening correction (2026-09-04).
 *
 * ── Two traps, not one ──────────────────────────────────────────────────────
 *
 * 1. "Root" is not a depth number a caller computed elsewhere — it is read off
 *    whatever the row itself carries: `tn_parent` (`null` = root) first,
 *    `tn_ancestors_pks` (`""` = root) second, a `CategoryTreeNode`'s `path`
 *    (no `/` = root) last. A caller that got the row from *some* endpoint
 *    should not also have to know which one before asking this.
 *
 * 2b. `children_as: "transparent"` (0.20.4) is a third page shape, not a
 *    depth or a child count: this node's own page IS its parent's — see
 *    {@link browseStage}'s `parent` argument.
 *
 * 2. "No children" is not "empty `children` array". `GET /tree/?depth=N` cuts
 *    the nesting at `N`, so a root read at a shallow depth can arrive with
 *    `children: []` despite having real ones. `children_pks`/`children_count`
 *    (stapel-categories 0.20.5's live answer) are consulted first; failing
 *    that, `tn_children_pks` (django-treenode's raw, ghost-inclusive column,
 *    a server predating 0.20.5's only signal); failing that, `children_as`
 *    survives the cut where the array does not — the server sends it `null`
 *    ONLY where a row truly has nothing to present, so a non-null value
 *    proves children exist even where the nested array was trimmed away. The
 *    nested array is the last resort, for a plain tree node that carries
 *    none of the above.
 */
import type { CategoryChildrenAs, CategoryTreeNode } from "../api/types.js";
import { warnLegacyFallback } from "./devWarn.js";
import { parseTreenodePks } from "./pks.js";

/**
 * The page shape a category's own screen takes.
 *
 * `"tiles"` — draw the children as a tile grid. `"feed"` — draw listings, with
 * a filter control from {@link childControl} when the children are worth one.
 */
export type BrowseStage = "tiles" | "feed";

/**
 * The shape of the filter a FEED page puts at the top of its rail, for
 * whatever children the category has.
 *
 * `"none"` — childless: nothing to filter by.
 * `"segmented"` — `children_as === "chips"`: the children are a partition of
 * one template, so the control is a single-select chip row over them.
 * `"list"` — anything else with children: a single-select subcategory list
 * with counts, the drill-down the search answer already carries.
 */
export type ChildControl = "none" | "segmented" | "list";

/**
 * What {@link browseStage} and {@link childControl} need from a row: parentage,
 * the resolved presentation, plus whichever of the two child channels the
 * caller has.
 *
 * Structural rather than a union of {@link Category} and
 * {@link CategoryTreeNode} so a host can pass either, or its own row, without
 * a cast — this is a rule about a handful of fields, not about a wire shape.
 */
export interface BrowseStageInput {
  readonly children_as?: CategoryChildrenAs | null;
  /** django-treenode's own parent pk — `null` for a root. Absent on a build
   * that predates the field, or on a shape that never carried it. */
  readonly tn_parent?: number | null;
  /** django-treenode's comma-joined ancestor pks — `""` for a root. */
  readonly tn_ancestors_pks?: string;
  /** The reader's own live children ids, in order (stapel-categories 0.20.5).
   * Preferred over `tn_children_pks` — see {@link hasChildren}. */
  readonly children_pks?: readonly number[];
  /** How many live children this row has, over the whole visible set
   * (stapel-categories 0.20.5) — the only channel a depth-capped
   * `CategoryTreeNode` carries, since it has no `children_pks` of its own.
   * Preferred over `tn_children_pks`, same as {@link children_pks}. */
  readonly children_count?: number;
  /** django-treenode's comma-joined pks. Counts soft-deleted and retired
   * rows too — a FALLBACK, read only when both `children_pks` and
   * `children_count` are absent (a server predating 0.20.5). */
  readonly tn_children_pks?: string;
  /** A `CategoryTreeNode`'s own root→self path (`"141/151"`) — no `/` for a
   * root. The last resort for parentage, on a shape with neither treenode
   * column. */
  readonly path?: string;
  /** The nested children of a tree read, cut at its depth. */
  readonly children?: readonly CategoryTreeNode[];
}

/**
 * Is this row a root — i.e. does it sit directly under the catalogue, with no
 * parent of its own?
 *
 * `tn_parent` first (the plainest possible answer), then `tn_ancestors_pks`,
 * then a tree node's own `path`. `false` when the row says nothing about its
 * parentage at all: "otherwise feed" is the safe default, not a guessed tile
 * grid.
 */
function isRoot(category: BrowseStageInput): boolean {
  if (category.tn_parent !== undefined) return category.tn_parent === null;
  if (typeof category.tn_ancestors_pks === "string") {
    return parseTreenodePks(category.tn_ancestors_pks).length === 0;
  }
  if (typeof category.path === "string") {
    return !category.path.includes("/");
  }
  return false;
}

/**
 * The row's own live child COUNT, when it states one at all —
 * `children_pks.length` first, `children_count` next (the only channel a
 * depth-capped `CategoryTreeNode` carries, since it has no `children_pks` of
 * its own), `tn_children_pks` parsed last as a FALLBACK for a server that
 * predates both (a dev build warns when this fallback fires — the column
 * counts soft-deleted and retired rows too, so it can overstate the answer).
 *
 * `undefined` when the row states none of the three — {@link hasChildren}'s
 * further fallbacks (`children_as`, the nested `children` array) answer a
 * boolean-only question no exact count exists for. Exported so
 * `catalog/wrapper.ts`'s `isWrapperAncestor` can ask "does the parent have
 * EXACTLY ONE child" without a second copy of this preference chain.
 */
export function categoryLiveChildCount(
  category: BrowseStageInput
): number | undefined {
  if (Array.isArray(category.children_pks)) return category.children_pks.length;
  if (typeof category.children_count === "number") return category.children_count;
  if (typeof category.tn_children_pks === "string") {
    warnLegacyFallback("children_pks/children_count", "tn_children_pks");
    return parseTreenodePks(category.tn_children_pks).length;
  }
  return undefined;
}

/**
 * Does this row have children at all, as far as the caller can tell?
 *
 * {@link categoryLiveChildCount} first — `children_pks`/`children_count`
 * (stapel-categories 0.20.5), falling back to `tn_children_pks` only on an
 * older server (see that function's own doc for the fallback's dev warning).
 * Then `children_as`: the server sends `null` ONLY where a row has no
 * children to present, so any other value proves children exist even where a
 * depth cap trimmed the nested array to `[]`. The nested `children` array is
 * the last resort. `undefined` on every channel means the caller handed a row
 * that says nothing about its children, and the honest default is "assume it
 * has some" — a tile grid or a chip row that turns out empty renders its own
 * empty state one layer down, which costs less than hiding a real
 * subcategory.
 *
 * Exported so `catalog/wrapper.ts` can ask the same question of a single
 * CHILD ("does it have children of its own") without a second copy of this
 * fallback chain — a wrapper check reading `children_as` differently from a
 * stage check would disagree with this file about the same row.
 */
export function hasChildren(category: BrowseStageInput): boolean {
  const liveCount = categoryLiveChildCount(category);
  if (liveCount !== undefined) return liveCount > 0;
  if (category.children_as !== undefined) return category.children_as !== null;
  if (category.children !== undefined) return category.children.length > 0;
  return true;
}

/**
 * The page shape this category's own screen takes — the browse contract's
 * two-level rule, in one call.
 *
 * `"tiles"` only for a ROOT that has children; `"feed"` for everything else,
 * including a childless root, any non-root node whatever its own children
 * look like, and a row this function cannot place at all.
 *
 * `children_as: "transparent"` (stapel-categories 0.20.4) is a THIRD case:
 * this node's own page is its parent's, so its own shape is whatever the
 * parent's is — pass `parent` when it is in hand and this delegates to
 * `browseStage(parent)` instead of computing a shape for a node that has no
 * real page. A host that lands on a transparent node's URL reads this as its
 * cue to redirect to the parent rather than render a page here. Without
 * `parent` the answer is `"feed"` — never `"tiles"` for a node that is not
 * itself a real destination.
 */
export function browseStage(
  category: BrowseStageInput,
  parent?: BrowseStageInput
): BrowseStage {
  if (category.children_as === "transparent") {
    return parent !== undefined ? browseStage(parent) : "feed";
  }
  return isRoot(category) && hasChildren(category) ? "tiles" : "feed";
}

/**
 * The filter a FEED page's rail puts at the top, for this category's own
 * children — see {@link ChildControl}.
 *
 * Meaningful on any category, root or not: a root's OWN page is tiles (this
 * file does not draw a filter there), but `childControl` still answers the
 * question correctly for a root that a caller reaches some other way (a
 * search result, a breadcrumb target) and wants to know what its children
 * would look like as a filter.
 */
export function childControl(category: BrowseStageInput): ChildControl {
  // A transparent node is never a destination: browsing has already skipped
  // it, so it offers no filter of its own — see `catalog/wrapper.ts`.
  if (category.children_as === "transparent") return "none";
  if (!hasChildren(category)) return "none";
  return category.children_as === "chips" ? "segmented" : "list";
}
