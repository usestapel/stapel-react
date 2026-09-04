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
import { isWrapperAncestor } from "../catalog/wrapper.js";
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
  /**
   * `false` when a skin must print this crumb as plain text — same
   * typography, no anchor — instead of a link. Default `true`; the current
   * crumb is always `true` here (`isCurrent` already keeps a skin from
   * linking it, so this field never has to say so a second time).
   *
   * Decided per crumb by {@link isWrapperAncestor} against the trail's own
   * rows unless {@link CategoryBreadcrumbsProps.unlink} is supplied, in which
   * case the host's predicate is the ONLY thing consulted — see that prop.
   */
  readonly linked: boolean;
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

/** A crumb's row and caption, before {@link CategoryCrumb.linked} is decided. */
export type CategoryCrumbInput = Omit<CategoryCrumb, "linked">;

export interface CategoryBreadcrumbsProps
  extends CategoryBrowseOptions,
    UseCategoryCatalogOptions {
  /** Resolved against the synced catalogue — the server has no slug lookup. */
  slug?: string;
  /** The fast path: one small read per crumb, no catalogue. */
  categoryId?: number | null;
  /**
   * Which crumbs to unlink, when the host holds knowledge the trail's own
   * rows cannot supply. Return `true` to print a crumb as plain text.
   *
   * Supplied, this REPLACES the automatic {@link isWrapperAncestor} check for
   * every crumb — a host that knows its own ancestry beats a guess made from
   * `tn_children_pks` alone, and running both would leave two authorities
   * disagreeing about the same crumb. Omitted, the automatic check runs.
   */
  unlink?: (crumb: CategoryCrumbInput) => boolean;
  children: (bag: CategoryBreadcrumbsBag) => ReactNode;
}

/**
 * Attach {@link CategoryCrumb.linked} to an ordered root → current row list.
 *
 * The automatic check needs the PREVIOUS row in this same array — a crumb's
 * parent, one step up the trail — which is why it is computed here, once,
 * rather than by each caller re-deriving "the row before this one."
 */
function attachLinked(
  rows: readonly CategoryCrumbInput[],
  unlink: ((crumb: CategoryCrumbInput) => boolean) | undefined
): readonly CategoryCrumb[] {
  return rows.map((row, index) => {
    if (row.isCurrent) return { ...row, linked: true };
    const parent = index > 0 ? rows[index - 1] : undefined;
    const hidden =
      unlink !== undefined
        ? unlink(row)
        : parent !== undefined && isWrapperAncestor(parent.category, row.category);
    return { ...row, linked: !hidden };
  });
}

export function CategoryBreadcrumbs(
  props: CategoryBreadcrumbsProps
): ReactNode {
  const {
    slug,
    categoryId,
    children,
    unlink,
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
                attachLinked(
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
                    })),
                  unlink
                )
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
      return attachLinked(
        path.map((node, i) => ({
          category: node.category,
          label: categoryLabel(node.category),
          isCurrent: i === path.length - 1,
        })),
        unlink
      );
    }),
    unknownSlug: catalog.status === "ready" && current === null,
    refetch: () => {
      void catalogQuery.refetch();
    },
  });
}
