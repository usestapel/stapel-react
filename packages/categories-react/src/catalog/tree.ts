/**
 * The tree the server does not build.
 *
 * `stapel-categories` has no tree endpoint. `GET /categories/` returns FLAT
 * rows ordered by `revision`, each carrying `tn_parent`, `tn_priority` and the
 * treenode ancestry columns — the client assembles the hierarchy (spec §4.3).
 * Everything in this file is pure: no React, no fetch, no storage, so the same
 * functions serve a browser, an SSR render and a test.
 *
 * ── Three server facts this module encodes, each a bug if forgotten ────────
 *
 * 1. **`deleted` rows are served.** `include_deleted` defaults to `true`, and
 *    the delta protocol NEEDS it that way. A tree built without filtering
 *    shows soft-deleted categories in a menu.
 * 2. **`active: false` rows are served too**, and nothing on the list endpoint
 *    filters them — only `carousel` does. "Active" is the storefront's
 *    visibility switch, so the public tree drops them by default and the
 *    option to keep them is explicit.
 * 3. **Order is `tn_priority` DESCENDING**, which is what both `children` and
 *    `carousel` do server-side (`views.py: order_by("-tn_priority")`). Ties
 *    are broken by `id` so a rebuild is deterministic — priority defaults to
 *    `0`, so a catalogue that never set it is ALL ties, and an unstable order
 *    there means the menu reshuffles between renders.
 */
import type { Category } from "../api/types.js";
import { parseTreenodePks } from "./pks.js";

/** One node of the assembled tree. */
export interface CategoryNode {
  readonly category: Category;
  readonly id: number;
  readonly depth: number;
  readonly children: readonly CategoryNode[];
}

/**
 * A built catalogue: the rows, plus the lookups a screen actually asks for.
 *
 * Built once per snapshot and shared, because every one of these questions is
 * asked on every render of every category page.
 */
export interface CategoryIndex {
  /** Roots, in display order. */
  readonly roots: readonly CategoryNode[];
  /** Every node by id, including ones filtered out of `roots`' subtrees? No —
   * only the nodes that survived the filter. What is not in the tree is not
   * addressable. */
  readonly byId: ReadonlyMap<number, CategoryNode>;
  /** Slug → node. See `resolveCategorySlug` for the collision rule. */
  readonly bySlug: ReadonlyMap<string, CategoryNode>;
  /** How many rows the source snapshot had before filtering. */
  readonly totalRows: number;
}

export interface BuildCategoryTreeOptions {
  /** Keep `deleted: true` rows. Default `false`. */
  readonly includeDeleted?: boolean;
  /** Keep `active: false` rows. Default `false` — the storefront's answer.
   * A catalogue admin passes `true`. */
  readonly includeInactive?: boolean;
}

function displayOrder(a: Category, b: Category): number {
  const pa = a.tn_priority ?? 0;
  const pb = b.tn_priority ?? 0;
  if (pa !== pb) return pb - pa;
  return a.id - b.id;
}

function keeps(row: Category, options: BuildCategoryTreeOptions): boolean {
  if (row.deleted === true && options.includeDeleted !== true) return false;
  // `active` is optional in the schema and defaults to true on the model, so
  // the test is "not explicitly false" — an absent field is an active
  // category, never a hidden one.
  if (row.active === false && options.includeInactive !== true) return false;
  return true;
}

/**
 * Assemble flat rows into a tree.
 *
 * A row whose `tn_parent` is not in the surviving set becomes a ROOT rather
 * than disappearing. That is not tidiness — it is the only safe answer to the
 * two ways it legitimately happens: a delta page that brought a child before
 * its parent, and a parent filtered out by `active: false` while the child was
 * left active by a catalogue editor. Dropping the subtree would delete a live
 * branch of the catalogue from the menu and give nobody a reason.
 */
export function buildCategoryTree(
  rows: Iterable<Category>,
  options: BuildCategoryTreeOptions = {}
): CategoryIndex {
  const all = [...rows];
  const kept = all.filter((row) => keeps(row, options)).sort(displayOrder);

  const childrenOf = new Map<number, Category[]>();
  const present = new Set<number>(kept.map((row) => row.id));
  const roots: Category[] = [];

  for (const row of kept) {
    const parent = row.tn_parent;
    if (parent === null || parent === undefined || !present.has(parent)) {
      roots.push(row);
      continue;
    }
    const bucket = childrenOf.get(parent);
    if (bucket === undefined) childrenOf.set(parent, [row]);
    else bucket.push(row);
  }

  const byId = new Map<number, CategoryNode>();
  const bySlug = new Map<string, CategoryNode>();

  // Iterative build (not recursion): a catalogue is authored data, and a cycle
  // introduced by a bad `tn_parent` would blow the stack instead of rendering.
  // `seen` makes a cycle a finite, visible truncation.
  function build(row: Category, depth: number, seen: ReadonlySet<number>): CategoryNode {
    const kids = childrenOf.get(row.id) ?? [];
    const nextSeen = new Set(seen).add(row.id);
    const node: CategoryNode = {
      category: row,
      id: row.id,
      depth,
      children: kids
        .filter((kid) => !nextSeen.has(kid.id))
        .map((kid) => build(kid, depth + 1, nextSeen)),
    };
    byId.set(row.id, node);
    if (row.slug !== "" && !bySlug.has(row.slug)) bySlug.set(row.slug, node);
    return node;
  }

  const builtRoots = roots.map((row) => build(row, 0, new Set<number>()));

  // A row that no root can reach is a row inside a PARENT CYCLE (`a.parent =
  // b, b.parent = a` — authored data, so possible). The recursion above
  // refuses to follow the cycle, which keeps the stack safe but would drop
  // those rows entirely: they would vanish from the menu with no error
  // anywhere. Promote whatever is left to roots instead, so a broken branch
  // is VISIBLE and fixable rather than absent.
  for (const row of kept) {
    if (byId.has(row.id)) continue;
    builtRoots.push(build(row, 0, new Set<number>()));
  }

  return { roots: builtRoots, byId, bySlug, totalRows: all.length };
}

/**
 * Resolve a URL slug to a category — the lookup the SERVER does not offer.
 *
 * `CategoryViewSet` never overrides `lookup_field` and the list endpoint has
 * no slug filter, so `GET /categories/<slug>/` is a 404 and `?slug=` is
 * ignored. The storefront's `/c/:slug` therefore resolves against the synced
 * tree (spec §4.3), which is one more reason the catalogue is cached rather
 * than fetched per page.
 *
 * `Category.slug` is `unique=True` at the model level, so a collision cannot
 * come from the database. It CAN come from the client's own snapshot — a
 * delta that renamed a slug from A to B arrives as one row, and a stale row
 * still holding B has not been evicted yet. First-in-display-order wins,
 * deterministically, and the loser is reachable by id.
 */
export function resolveCategorySlug(
  index: CategoryIndex,
  slug: string
): CategoryNode | undefined {
  return index.bySlug.get(slug);
}

/**
 * The path from the root down to `id`, inclusive — the breadcrumb.
 *
 * Walks `tn_parent` through the built index rather than trusting
 * `tn_ancestors_pks`, because the index is what the screen is showing: if a
 * filter removed an ancestor, the crumb must not name a category the visitor
 * cannot open. `categoryAncestorIds` is the other answer — the server's — and
 * the two are compared in `test/tree.test.ts` precisely so a divergence is a
 * red test rather than a subtly wrong crumb.
 *
 * An unknown id gives `[]`, not a partial path: half a breadcrumb reads as a
 * top-level category.
 */
export function categoryBreadcrumbs(
  index: CategoryIndex,
  id: number | null | undefined
): readonly CategoryNode[] {
  if (id === null || id === undefined) return [];
  const start = index.byId.get(id);
  if (start === undefined) return [];

  const path: CategoryNode[] = [start];
  const seen = new Set<number>([start.id]);
  let cursor = start.category.tn_parent;
  while (cursor !== null && cursor !== undefined && !seen.has(cursor)) {
    const parent = index.byId.get(cursor);
    if (parent === undefined) break;
    path.push(parent);
    seen.add(parent.id);
    cursor = parent.category.tn_parent;
  }
  return path.reverse();
}

/**
 * The server's own answer to "who are this row's ancestors", root-first, from
 * `tn_ancestors_pks`.
 *
 * Useful without a built index (a single category fetched on its own), and the
 * cross-check for {@link categoryBreadcrumbs}.
 */
export function categoryAncestorIds(category: Category): readonly number[] {
  return parseTreenodePks(category.tn_ancestors_pks);
}

/**
 * The server's own answer to "who are this row's children", from
 * `tn_children_pks`.
 *
 * This is the FULL child set, including soft-deleted and inactive rows — the
 * column is maintained by treenode, which knows nothing about either flag. Use
 * it to detect "this category has sub-categories at all"; use the built node's
 * `children` to render them.
 */
export function categoryChildIds(category: Category): readonly number[] {
  return parseTreenodePks(category.tn_children_pks);
}

/** Depth-first walk of a subtree (or the whole forest), in display order. */
export function flattenCategoryNodes(
  nodes: readonly CategoryNode[]
): readonly CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (list: readonly CategoryNode[]): void => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
