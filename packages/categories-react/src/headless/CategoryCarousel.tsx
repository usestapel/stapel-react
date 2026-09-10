import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type {
  Category,
  CategoryChild,
  CategoryVirtualChild,
} from "../api/types.js";
import { categoryLabel } from "../catalog/labels.js";
import type { CategoryLabel } from "../catalog/labels.js";
import { warnMissingVirtualHref } from "../catalog/devWarn.js";
import { isRowChild } from "../catalog/stage.js";
import { useCategoryCarousel } from "../model/queries.js";

/** One carousel tile. */
export interface CarouselEntry {
  readonly category: Category;
  readonly label: CategoryLabel;
  /**
   * The tile's icon reference — `carousel_icon`, falling back to
   * `catalog_icon`. Both are OPAQUE STRINGS, deliberately decoupled from
   * stapel-cdn ("an opaque string, resolved by the host if at all",
   * `models.py`). This pair does not build a URL out of one: the host knows
   * its CDN base, this library does not, and a guessed URL is a broken image
   * on every deployment that guessed differently.
   */
  readonly icon: string | null;
  /** The storefront path for this tile. Slug-based, because that is the
   * route the spec defines — and the reason the client resolves slugs. */
  readonly href: string;
}

/**
 * One tile for a VALUE of an expanded branch — a child with no row behind it
 * (stapel-categories 0.22.0).
 *
 * A separate shape from {@link CarouselEntry} rather than a `CarouselEntry`
 * with a fabricated `category`: there IS no row, and inventing one would give
 * the tile an id that addresses somebody else's category. What it has instead
 * is the `filter` pair, and the `href` the HOST built out of it.
 */
export interface VirtualTileEntry {
  /** The wire node, `filter` included — handed on so a host that renders its
   * own tile keeps the pair without a second lookup. */
  readonly virtual: CategoryVirtualChild;
  /** The value's own display string. A translation KEY like every other name
   * in this contract — see `catalog/labels.ts`. */
  readonly label: CategoryLabel;
  /** What {@link VirtualChildHref} answered for this node's `filter`. */
  readonly href: string;
}

/** A tile of either kind — a row (real or a POINTER at one), or a VALUE. */
export type CategoryTileEntry = CarouselEntry | VirtualTileEntry;

/**
 * WHAT URL A VIRTUAL CHILD'S `filter` BECOMES — the host's answer, because it
 * is the only one that exists.
 *
 * A virtual child selects listings on the PARENT category by a
 * `{feature slug: value}` pair, and how that pair is spelled in an address is
 * the storefront's own scheme: a query string, a path segment, an encoded
 * facet state. This pair refuses to guess one — a guessed route is a dead
 * link on every deployment that spells it differently, which is the same rule
 * `categoryIconSrc` keeps about a CDN base.
 *
 * The node is passed beside the pair so a host can read `value` and `name`
 * without re-deriving them from the filter's single entry.
 */
export type VirtualChildHref = (
  filter: Readonly<Record<string, string>>,
  child: CategoryVirtualChild
) => string;

/**
 * The children of one category, mapped to tiles — rows, pointers and values
 * alike, IN THE ORDER THE SERVER SENT THEM.
 *
 * Order is the whole reason this is one function rather than two: the server
 * inserts a pointer at the `order` its operator gave it, among the real
 * children, and a caller that mapped the two kinds separately and concatenated
 * would silently move it to the end.
 *
 * Without `hrefForVirtual` a virtual child is OMITTED and a development build
 * says so. Dropping it is the lesser of the two honest answers — the other is
 * a tile whose `href` is `""` — and it is loud rather than silent.
 */
export function categoryChildTileEntries(
  children: readonly CategoryChild[],
  basePath: string,
  hrefForVirtual?: VirtualChildHref
): readonly CategoryTileEntry[] {
  const out: CategoryTileEntry[] = [];
  for (const child of children) {
    if (isRowChild(child)) {
      out.push(categoryTileEntry(child, basePath));
      continue;
    }
    if (hrefForVirtual === undefined) {
      warnMissingVirtualHref();
      continue;
    }
    out.push({
      virtual: child,
      label: { kind: "key", value: child.name },
      href: hrefForVirtual(child.filter, child),
    });
  }
  return out;
}

export interface CategoryCarouselBag {
  /**
   * The tiles. `empty` means the catalogue has no `carousel_enabled`
   * categories — a real configuration, and a landing page that says nothing
   * rather than showing a spinner forever.
   */
  readonly state: LoadState<readonly CarouselEntry[]>;
  readonly isFetching: boolean;
  refetch(): void;
}

/**
 * One row -> one tile, the ONE mapping in this pair.
 *
 * Extracted because the carousel bag is no longer its only caller: a category
 * landing draws its own CHILDREN as tiles (`<CategoryPage subcategories=
 * "tiles">`), and those rows never pass through `GET /categories/carousel/`.
 * A second copy of the mapping would drift on the one detail that is easy to
 * get wrong and invisible when wrong — the icon fallback order — and a
 * deployment with `catalog_icon` set and `carousel_icon` empty would draw art
 * on the home page and monograms one level down.
 *
 * The icon is `carousel_icon`, falling back to `catalog_icon`, falling back to
 * `null`. `""` is an ABSENT reference, not a reference to an empty string:
 * that is the state every catalogue is in until somebody uploads art, and it
 * is what every row on a live classified deployment carries today.
 */
export function categoryTileEntry(
  category: Category,
  basePath: string
): CarouselEntry {
  const reference =
    category.carousel_icon !== undefined && category.carousel_icon !== ""
      ? category.carousel_icon
      : category.catalog_icon !== undefined && category.catalog_icon !== ""
        ? category.catalog_icon
        : null;
  return {
    category,
    label: categoryLabel(category),
    icon: reference,
    href: `${basePath}/${category.slug}`,
  };
}

export interface CategoryCarouselProps {
  /** Path prefix for a tile's link. Default `/c` — the spec's `/c/:slug`. */
  basePath?: string;
  enabled?: boolean;
  children: (bag: CategoryCarouselBag) => ReactNode;
}

/**
 * The landing page's category strip.
 *
 * `GET /categories/carousel/` is the one endpoint that arrives ready to
 * render: the server filters `active` AND `carousel_enabled`, orders by
 * `tn_priority` descending, caches the serialization and sends
 * `Cache-Control: public, max-age`. So this component does no filtering of its
 * own — it maps rows to tiles and says which strings still need translating.
 */
export function CategoryCarousel(props: CategoryCarouselProps): ReactNode {
  const base = props.basePath ?? "/c";
  const query = useCategoryCarousel(
    props.enabled !== undefined ? { enabled: props.enabled } : {}
  );
  const state = loadStateFromQuery(query);

  return props.children({
    state: mapLoad(state, (rows) =>
      rows.map((category) => categoryTileEntry(category, base))
    ),
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  });
}
