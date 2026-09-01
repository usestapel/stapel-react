/**
 * The ancestry of the current category, as data — and, given an ID, without
 * the catalogue.
 *
 * ── Two sources, and why the ID one is the good one ────────────────────────
 *
 * `tn_ancestors_pks` on a row is the server's own chain, root-first. So the
 * whole breadcrumb of a category six levels deep is one 300-byte `GET {id}/`
 * for the row plus six more for the names — seven small answers that every
 * other surface on the page then finds in the cache. The catalogue that
 * answers the same question costs 1.4 MB and, on a live classified
 * deployment, twenty seconds.
 *
 * `slug` still walks the BUILT INDEX, because `stapel-categories` has no slug
 * lookup (`lookup_field` is never overridden, the list has no `slug` filter)
 * and a slug therefore cannot be resolved without the catalogue. That is a
 * contract gap, recorded in MODULE.md, not a preference — and it is why
 * `categoryId` is the mode a fast storefront routes through.
 *
 * ── Why the ID mode does not "walk the index" ──────────────────────────────
 *
 * The index version deliberately walked `tn_parent` through the built tree
 * rather than trusting `tn_ancestors_pks`, so that a crumb could never name a
 * category the visitor's own filters had removed. Without a tree there is
 * nothing to walk, so the server's column IS the chain — and the browse
 * predicate is applied to the FETCHED ROWS instead: an ancestor that is a
 * tombstone or inactive is dropped from the trail, which reaches the same
 * answer one row at a time. `test/tree.test.ts` still cross-checks the two
 * chains against each other on a fixture, so a divergence stays a red test.
 */
import type { ReactNode } from "react";
import { loadFailed, loadLoading, loadReady, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { loadStateFromQuery } from "@stapel/core";
import type { Category } from "../api/types.js";
import { isBrowsableCategory } from "../catalog/browse.js";
import { categoryBreadcrumbs, resolveCategorySlug } from "../catalog/tree.js";
import type { CategoryNode } from "../catalog/tree.js";
import { categoryAncestorChain } from "../catalog/cascade.js";
import { categoryLabel } from "../catalog/labels.js";
import type { CategoryLabel } from "../catalog/labels.js";
import {
  useCategory,
  useCategoryCatalog,
  useCategoryRows,
} from "../model/queries.js";
import type {
  CategoryBrowseOptions,
  UseCategoryCatalogOptions,
} from "../model/queries.js";

/** One crumb: the row, and how its caption must be rendered. */
export interface CategoryCrumb {
  readonly category: Category;
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

export interface CategoryBreadcrumbsProps
  extends CategoryBrowseOptions,
    UseCategoryCatalogOptions {
  /** Resolved against the synced catalogue — the server has no slug lookup. */
  slug?: string;
  /** The fast path: one small read per crumb, no catalogue. */
  categoryId?: number | null;
  children: (bag: CategoryBreadcrumbsBag) => ReactNode;
}

export function CategoryBreadcrumbs(
  props: CategoryBreadcrumbsProps
): ReactNode {
  const {
    slug,
    categoryId,
    children,
    includeDeleted,
    includeInactive,
    includeTest,
    ...catalogOptions
  } = props;
  const visibility: CategoryBrowseOptions = {
    ...(includeDeleted !== undefined ? { includeDeleted } : {}),
    ...(includeInactive !== undefined ? { includeInactive } : {}),
    ...(includeTest !== undefined ? { includeTest } : {}),
  };
  // A slug is the ONLY reason to transfer a catalogue here. An id never does.
  const bySlug = slug !== undefined;

  const currentQuery = useCategory(bySlug ? null : (categoryId ?? null));
  const ancestorIds = categoryAncestorChain(currentQuery.data);
  const ancestors = useCategoryRows(bySlug ? [] : [...ancestorIds]);
  const catalogQuery = useCategoryCatalog({
    ...catalogOptions,
    ...visibility,
    enabled: bySlug && (props.enabled ?? true),
  });

  if (!bySlug) {
    const current = currentQuery.data ?? null;
    const state: LoadState<readonly CategoryCrumb[]> =
      currentQuery.error != null
        ? loadFailed(currentQuery.error)
        : ancestors.error != null
          ? loadFailed(ancestors.error)
          : current === null || ancestors.rows.some((row) => row === null)
            ? loadLoading()
            : loadReady(
                [...ancestors.rows.filter((row): row is Category => row !== null), current]
                  // An ancestor the storefront may not offer is not a crumb:
                  // the trail must not link somewhere the visitor cannot go.
                  // The CURRENT row is kept whatever it says — the caller
                  // named it, and dropping it would blank the page's title.
                  .filter(
                    (row, index, all) =>
                      index === all.length - 1 ||
                      isBrowsableCategory(row, visibility)
                  )
                  .map((row, index, all) => ({
                    category: row,
                    label: categoryLabel(row),
                    isCurrent: index === all.length - 1,
                  }))
              );
    return children({
      state,
      unknownSlug: false,
      refetch: () => {
        void currentQuery.refetch();
      },
    });
  }

  const catalog = loadStateFromQuery(catalogQuery);
  const index = catalog.status === "ready" ? catalog.data.index : null;
  let current: CategoryNode | null = null;
  if (index !== null && slug !== undefined) {
    current = resolveCategorySlug(index, slug) ?? null;
  }

  return children({
    state: mapLoad(catalog, (data) => {
      const path = categoryBreadcrumbs(data.index, current?.id);
      return path.map((node, i) => ({
        category: node.category,
        label: categoryLabel(node.category),
        isCurrent: i === path.length - 1,
      }));
    }),
    unknownSlug: catalog.status === "ready" && current === null,
    refetch: () => {
      void catalogQuery.refetch();
    },
  });
}
