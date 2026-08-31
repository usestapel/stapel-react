import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { Category } from "../api/types.js";
import { categoryLabel } from "../catalog/labels.js";
import type { CategoryLabel } from "../catalog/labels.js";
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
