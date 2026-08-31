import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { nodeOffersTileGrid } from "../catalog/tiles.js";
import { categoryBreadcrumbs, resolveCategorySlug } from "../catalog/tree.js";
import type { CategoryIndex, CategoryNode } from "../catalog/tree.js";
import { useCategoryCatalog } from "../model/queries.js";
import type {
  CategoryCatalog,
  UseCategoryCatalogOptions,
} from "../model/queries.js";

/** The bag `<CategoryTree>` hands its render prop. */
export interface CategoryTreeBag {
  /**
   * The nodes to render at this level. `empty` means the catalogue really has
   * no categories here — reachable only from a sync that succeeded, which is
   * the whole reason it is a separate arm from `failed`.
   */
  readonly state: LoadState<readonly CategoryNode[]>;
  /** The full built catalogue, for a skin that wants more than one level. */
  readonly catalog: LoadState<CategoryCatalog>;
  /** The node `slug`/`categoryId` selected, once the catalogue has loaded. */
  readonly current: CategoryNode | null;
  /**
   * May `state`'s rows be offered as a TILE GRID?
   *
   * The catalogue model has tiles for the top level and for a top-level
   * category's children, and nothing deeper — below that a category is a
   * CHARACTERISTIC picked in a cascading selector, not a place to navigate to
   * (`catalog/tiles.ts`, {@link MAX_TILE_DEPTH}). `false` does not mean the
   * level is empty and does not mean it is unreachable: the rows are right
   * here in `state`, and a skin renders them as a list. It means they must not
   * be drawn as tiles.
   */
  readonly offersTiles: boolean;
  /** Root → current, inclusive. `[]` when nothing is selected. */
  readonly breadcrumbs: readonly CategoryNode[];
  /**
   * A slug that is not in the loaded catalogue. `true` only once the
   * catalogue is `ready` — before that the honest answer is "we do not know
   * yet", and a skin that renders "category not found" during a sync is
   * showing a 404 for a page that exists.
   */
  readonly unknownSlug: boolean;
  /**
   * The page budget stopped the sync walk: this tree is INCOMPLETE. Distinct
   * from `empty` in the same way `failed` is — a branch missing here was not
   * read, not absent.
   */
  readonly truncated: boolean;
  readonly isFetching: boolean;
  refetch(): void;
}

export interface CategoryTreeProps extends UseCategoryCatalogOptions {
  /** Render the children of this category instead of the roots. */
  parentId?: number | null;
  /** Select a category by slug — the `/c/:slug` route's job. Resolved against
   * the synced tree because the server has no slug lookup. */
  slug?: string;
  /** Select a category by id. Ignored when `slug` is given. */
  categoryId?: number | null;
  children: (bag: CategoryTreeBag) => ReactNode;
}

function levelOf(
  index: CategoryIndex,
  parentId: number | null | undefined,
  current: CategoryNode | null
): readonly CategoryNode[] {
  if (parentId !== null && parentId !== undefined) {
    return index.byId.get(parentId)?.children ?? [];
  }
  // With a category selected and no explicit parent, "the level" is that
  // category's own sub-categories — which is what a category page shows. A
  // LEAF category has none, and that empty is a true empty: the skin below it
  // renders listings, not a menu.
  if (current !== null) return current.children;
  return index.roots;
}

/**
 * Headless category navigation over the delta-synced catalogue.
 *
 * One hook mounted anywhere in the tree serves every level: the roots on the
 * catalogue page, one category's children on `/c/:slug`, the breadcrumb above
 * either. Nothing here issues a request per level — the tree is already in
 * memory (see `useCategoryCatalog`), which is precisely the property the spec
 * asked for in §4.3.
 */
export function CategoryTree(props: CategoryTreeProps): ReactNode {
  const {
    parentId,
    slug,
    categoryId,
    children,
    ...catalogOptions
  } = props;
  const query = useCategoryCatalog(catalogOptions);
  const catalog = loadStateFromQuery(query);
  const index = catalog.status === "ready" ? catalog.data.index : null;

  let current: CategoryNode | null = null;
  if (index !== null) {
    if (slug !== undefined) current = resolveCategorySlug(index, slug) ?? null;
    else if (categoryId !== null && categoryId !== undefined) {
      current = index.byId.get(categoryId) ?? null;
    }
  }

  // Whose children this level IS decides the tile rule: an explicit
  // `parentId` when the host asked for one, otherwise the selected category,
  // otherwise the catalogue root (which is above every category and always
  // offers tiles).
  const levelOwner =
    index === null
      ? null
      : parentId !== null && parentId !== undefined
        ? (index.byId.get(parentId) ?? null)
        : current;

  return children({
    state: mapLoad(catalog, (data) =>
      levelOf(data.index, parentId, current)
    ),
    catalog,
    current,
    offersTiles: nodeOffersTileGrid(levelOwner),
    breadcrumbs:
      index === null ? [] : categoryBreadcrumbs(index, current?.id),
    unknownSlug:
      catalog.status === "ready" && slug !== undefined && current === null,
    truncated: catalog.status === "ready" && catalog.data.truncated,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  });
}
