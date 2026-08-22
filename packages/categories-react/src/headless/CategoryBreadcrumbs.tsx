import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { categoryBreadcrumbs, resolveCategorySlug } from "../catalog/tree.js";
import type { CategoryNode } from "../catalog/tree.js";
import { categoryLabel } from "../catalog/labels.js";
import type { CategoryLabel } from "../catalog/labels.js";
import { useCategoryCatalog } from "../model/queries.js";
import type { UseCategoryCatalogOptions } from "../model/queries.js";

/** One crumb: the node, and how its caption must be rendered. */
export interface CategoryCrumb {
  readonly node: CategoryNode;
  /** `kind: "key"` → run `value` through the host's `t`. See
   * `catalog/labels.ts` — names on the wire are translation keys. */
  readonly label: CategoryLabel;
  /** `true` for the last crumb — the page you are on. */
  readonly isCurrent: boolean;
}

export interface CategoryBreadcrumbsBag {
  /**
   * Root → current, inclusive. `empty` means the selected category IS a root
   * (there is nothing above it), which is a different thing from a catalogue
   * that has not loaded and from a slug that does not exist.
   */
  readonly state: LoadState<readonly CategoryCrumb[]>;
  readonly unknownSlug: boolean;
  refetch(): void;
}

export interface CategoryBreadcrumbsProps extends UseCategoryCatalogOptions {
  slug?: string;
  categoryId?: number | null;
  children: (bag: CategoryBreadcrumbsBag) => ReactNode;
}

/**
 * The ancestry of the current category, as data.
 *
 * Walks the BUILT index rather than `tn_ancestors_pks`: a crumb must name a
 * category the visitor can actually open, and the built index is what the
 * visitor is being shown. The server's own column is exposed separately
 * (`categoryAncestorIds`) and the two are cross-checked in the suite, so a
 * divergence is a red test rather than a link to nowhere.
 */
export function CategoryBreadcrumbs(
  props: CategoryBreadcrumbsProps
): ReactNode {
  const { slug, categoryId, children, ...catalogOptions } = props;
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

  return children({
    state: mapLoad(catalog, (data) => {
      const path = categoryBreadcrumbs(data.index, current?.id);
      return path.map((node, i) => ({
        node,
        label: categoryLabel(node.category),
        isCurrent: i === path.length - 1,
      }));
    }),
    unknownSlug:
      catalog.status === "ready" && slug !== undefined && current === null,
    refetch: () => {
      void query.refetch();
    },
  });
}
