/**
 * WHICH PAGE A CATEGORY GETS — the browse-stage rule, stated once.
 *
 * `catalog/tiles.ts` answers a question about DEPTH ("how far down may a tile
 * grid go"). This answers a question about SHAPE, and the server now resolves
 * it per row rather than the client inferring it: `children_as` says whether a
 * category's children are real subcategories or a partition of one template.
 *
 *   children_as: "tiles"   the children diverge in attribute schema, or have
 *                          children of their own  → a tile grid, no feed
 *   children_as: "chips"   the children are the SAME attribute set split by a
 *                          value their name expresses (new/used, buy/sell/rent,
 *                          boys/girls) → a feed on the PARENT, with a
 *                          single-select chip row
 *   no children            a leaf → a feed
 *
 * So there are two page shapes, not three, and this file names them. A `chips`
 * parent is a feed page exactly like a leaf is: the chip row is a filter
 * control on that page, not a level of the tree. The children keep their ids,
 * their paths and their URLs and remain the placement target of a listing —
 * only the presentation changes, which is why nothing here removes a node from
 * anything.
 *
 * ── The one trap: "no children" is not "empty children array" ──────────────
 *
 * `GET /tree/?depth=N` CUTS the nesting at `N`, so a node on the last level
 * always arrives with no children whether or not it has any. Reading that as
 * "leaf" would give a whole level of the catalogue the wrong page. A row from
 * the flat list carries `tn_children_pks`, which is the WHOLE truth about its
 * children regardless of what any read cut off, so it is consulted first and
 * the nested array only when there is no such string.
 */
import type { CategoryChildrenAs, CategoryTreeNode } from "../api/types.js";
import { parseTreenodePks } from "./pks.js";

/**
 * The page shape a category's own screen takes.
 *
 * `"tiles"` — draw the children as a tile grid. `"feed"` — draw listings, with
 * a chip row when the children are a partition.
 */
export type BrowseStage = "tiles" | "feed";

/**
 * What {@link browseStage} needs from a row: the resolved presentation, plus
 * whichever of the two child channels the caller has.
 *
 * Structural rather than a union of {@link Category} and
 * {@link CategoryTreeNode} so a host can pass either, or its own row, without
 * a cast — this is a rule about three fields, not about a wire shape.
 */
export interface BrowseStageInput {
  readonly children_as?: CategoryChildrenAs | null;
  /** django-treenode's comma-joined pks — authoritative when present. */
  readonly tn_children_pks?: string;
  /** The nested children of a tree read, cut at its depth. */
  readonly children?: readonly CategoryTreeNode[];
}

/**
 * Does this row have children at all, as far as the caller can tell?
 *
 * `tn_children_pks` first — see this file's header. `undefined` on BOTH
 * channels means the caller handed a row that says nothing about its children,
 * and the honest answer is "we do not know it is a leaf": a chip row is
 * suppressed by `children_as`, and a tile grid that turns out to have no rows
 * renders its own empty state one layer down.
 */
function hasChildren(category: BrowseStageInput): boolean {
  if (typeof category.tn_children_pks === "string") {
    return parseTreenodePks(category.tn_children_pks).length > 0;
  }
  if (category.children !== undefined) return category.children.length > 0;
  return true;
}

/**
 * The page shape this category's own screen takes — the rule of the browse
 * contract §1, in one call.
 *
 * `chips` and childless both land on `"feed"`, and that is the point: the chip
 * row is a control ON the feed page, so a parent that partitions its children
 * renders the same page a leaf does, with one extra filter. Everything else is
 * `"tiles"`.
 */
export function browseStage(category: BrowseStageInput): BrowseStage {
  if (!hasChildren(category)) return "feed";
  return category.children_as === "chips" ? "feed" : "tiles";
}
