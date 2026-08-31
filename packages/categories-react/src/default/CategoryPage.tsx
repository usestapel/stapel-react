/**
 * `<CategoryPage>` — the `/c/:slug` screen: breadcrumbs, sub-categories, and a
 * SLOT where the listings go.
 *
 * The slot is the whole design. Spec §5.1 makes this route "categories +
 * search": the sub-category menu comes from here, the results with facets come
 * from `@stapel/search-react`. A pair may not import another L2 pair
 * (dependency direction is strictly downward), and a screen that rendered only
 * half of itself would be useless — so the half this pair does not own is a
 * render prop, handed the resolved category. The container writes one line:
 *
 * ```tsx
 * <CategoryPage
 *   slug={slug}
 *   renderListings={(category) => (
 *     <SearchPage adapter={useRouterSearchParams()} defaultType="listing"
 *                 fixedCategory={category.id} />
 *   )}
 * />
 * ```
 *
 * And when the container does NOT write it, the page says so instead of
 * rendering silence: an unfilled slot is `<SlotPlaceholder>` — a named dashed
 * region in a development build, nothing in production. A page that renders
 * breadcrumbs, sub-categories and then a wordless gap where every listing
 * belongs looks finished, which is exactly why nobody reports it.
 *
 * `slug` resolution happens against the synced tree because the SERVER cannot
 * do it (`nav/manifest.ts`, `catalog/tree.ts`). Until the catalogue has
 * loaded, an unknown slug is not yet unknown — the "no category here" line is
 * shown only once the sync succeeded, so a slow network never renders a 404
 * for a page that exists.
 *
 * ── One form of sub-categories, chosen here ────────────────────────────────
 *
 * The sub-category menu used to be a titled LIST and nothing else, with no way
 * to ask for anything different. A host that wanted the reference design's
 * TILES therefore mounted `<CategoryTileGrid>` alongside this page and hid the
 * list with its own stylesheet — which a live classified deployment does
 * today: on a 390px viewport both `categories-tree-list` and
 * `categories-tile-grid-list` are in the DOM, the same links rendered twice,
 * one of them invisible. A host hiding a pair's output with CSS is the pair's
 * bug: the page rendered something the host could not decline.
 *
 * {@link CategoryPageProps.subcategories} is that decision, taken once and
 * rendered once. The arm that is not chosen is not MOUNTED — it does not
 * render hidden, and its testid is absent from the document, which is what
 * makes "one list" checkable rather than a claim about stylesheets.
 */
import { spacing } from "@stapel/tokens";
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { SlotPlaceholder, useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { Category } from "../api/types.js";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import { categoryOffersTileGrid } from "../catalog/tiles.js";
import type { CategoryNode } from "../catalog/tree.js";
import { categoryTileEntry } from "../headless/CategoryCarousel.js";
import type { CarouselEntry } from "../headless/CategoryCarousel.js";
import { CategoryTree } from "../headless/CategoryTree.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryBreadcrumbsBar } from "./CategoryBreadcrumbsBar.js";
import { CategoryFeatureList } from "./CategoryFeatureList.js";
import { CategoryTileGrid } from "./CategoryTileGrid.js";
import { CategoryTreePane } from "./CategoryTreePane.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import type { ThemeModeProp } from "./types.js";

/**
 * How wide a catalogue screen may get. Without one, a 1280px window put the
 * "2 subcategories" chip ~2,300px from the label it counts and left more than
 * 90% of the page empty.
 */
export const CATEGORY_MEASURE = "64rem";

export interface CategoryPageProps extends ThemeModeProp, LinkComponentProp {
  /** The `:slug` segment of `/c/:slug`. */
  readonly slug: string;
  readonly basePath?: string;
  /** The listings half of the screen — supplied by the container, because it
   * belongs to another pair. Unfilled, the gap NAMES itself in development
   * (see this file's header). */
  readonly renderListings?: (category: Category) => ReactNode;
  /** Show the category's feature schema. Off by default: on a storefront the
   * schema is the facet panel's input, not a visitor-facing table. */
  readonly showFeatures?: boolean;
  /**
   * Which FORM the sub-categories take. Default `"pane"` — what this page has
   * always rendered, so no existing host changes behaviour.
   *
   * Exactly one arm is mounted; see this file's header for the defect that
   * made this a prop rather than a stylesheet.
   */
  readonly subcategories?: SubcategoryForm;
  /**
   * Turn a tile's opaque icon reference into something renderable — the same
   * contract `<CategoryTileGrid>` and `<CategoryCarouselStrip>` take, and
   * meaningful only on the `"tiles"` arm. Absent, a tile draws the category's
   * own initial; this page never builds a URL out of a reference.
   */
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
}

/**
 * How a category page offers what is inside it.
 *
 * `"pane"`   a titled LIST of links (`<CategoryTreePane>`) — the default, and
 *            the only shape this page had.
 * `"tiles"`  the reference design's tile grid, subject to the catalogue's
 *            depth cap (`catalog/tiles.ts`): past it, NOTHING is rendered and
 *            there is no fall back to the pane, because the canon says a
 *            deeper level is chosen as a characteristic rather than browsed.
 * `"none"`   neither. For a host that draws its own sub-category chrome and
 *            wants the rest of this page.
 */
export type SubcategoryForm = "pane" | "tiles" | "none";

/**
 * The chosen arm, and only it.
 *
 * A leaf renders nothing in every arm: "this category has no sub-categories"
 * is `<CategoryTreePane>`'s empty sentence on a page that came looking for
 * them, not something to say under a heading on a page whose listings are the
 * point.
 */
function Subcategories(props: {
  readonly form: SubcategoryForm;
  readonly current: CategoryNode;
  readonly slug: string;
  readonly basePath: string;
  readonly linkComponent?: LinkComponent;
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
}): ReactElement | null {
  const t = useT();
  const link =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};

  if (props.form === "none") return null;
  if (props.current.children.length === 0) return null;

  if (props.form === "tiles") {
    // The cap is read HERE as well as inside the grid, because the heading
    // belongs to the grid: rendering the title and letting the grid answer
    // `null` would leave a "Subcategories" heading over nothing.
    if (!categoryOffersTileGrid(props.current.depth)) return null;
    return (
      <Flex vertical gap={spacing[2]}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t(CATEGORIES_I18N_KEYS.categorySubcategories)}
        </Typography.Title>
        <CategoryTileGrid
          {...link}
          {...(props.renderIcon !== undefined
            ? { renderIcon: props.renderIcon }
            : {})}
          basePath={props.basePath}
          categoryDepth={props.current.depth}
          // Already inside a category: an "All" tile here points at the
          // catalogue root the visitor has just come from.
          allTile={false}
          entries={props.current.children.map((node) =>
            categoryTileEntry(node.category, props.basePath)
          )}
        />
      </Flex>
    );
  }

  return (
    <CategoryTreePane
      slug={props.slug}
      basePath={props.basePath}
      titleKey={CATEGORIES_I18N_KEYS.categorySubcategories}
      {...link}
    />
  );
}

export function CategoryPage(props: CategoryPageProps): ReactElement {
  const t = useT();
  const base = props.basePath ?? "/c";
  const link =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryTree slug={props.slug}>
        {(bag) => (
          <Flex
            vertical
            gap={spacing[4]}
            style={{ padding: spacing[4], maxWidth: CATEGORY_MEASURE }}
            data-testid="categories-category-page"
          >
            {/* The page owns the outage and the dead address; the bar under
                the same read must not state either a second time in a second
                visual language. */}
            <CategoryBreadcrumbsBar
              slug={props.slug}
              basePath={base}
              onAbsent="quiet"
              {...link}
            />

            <LoadBoundary
              state={bag.catalog}
              testId="categories-category"
              onRetry={bag.refetch}
              skeletonRows={4}
              failed={(error) => (
                // The substrate's default arm would say "something went
                // wrong"; this pair knows WHICH thing, and keeps the
                // technical detail core split off beside it.
                <ErrorAlert
                  testId="categories-category-failed"
                  thrown={error}
                  message={t(CATEGORIES_I18N_KEYS.catalogLoadFailed)}
                  onRetry={bag.refetch}
                />
              )}
            >
              {() =>
                bag.current === null ? (
                  <EmptyState
                    testId="categories-category-unknown"
                    title={t(CATEGORIES_I18N_KEYS.categoryUnknownSlug)}
                    hint={t(CATEGORIES_I18N_KEYS.categoryUnknownSlugHint)}
                    // A dead end that only says "start again from the
                    // catalogue" without a way there is still a dead end.
                    action={
                      <CategoryLink
                        {...(props.linkComponent !== undefined
                          ? { linkComponent: props.linkComponent }
                          : {})}
                        href={base}
                      >
                        {t(CATEGORIES_I18N_KEYS.categoryBackToCatalog)}
                      </CategoryLink>
                    }
                  />
                ) : (
                  <Flex vertical gap={spacing[4]}>
                    <Typography.Title level={3} style={{ margin: 0 }}>
                      {renderCategoryLabel(
                        categoryLabel(bag.current.category),
                        t
                      )}
                    </Typography.Title>

                    <Subcategories
                      form={props.subcategories ?? "pane"}
                      current={bag.current}
                      slug={props.slug}
                      basePath={base}
                      {...link}
                      {...(props.renderIcon !== undefined
                        ? { renderIcon: props.renderIcon }
                        : {})}
                    />

                    {props.showFeatures === true ? (
                      <CategoryFeatureList categoryId={bag.current.id} />
                    ) : null}

                    {props.renderListings !== undefined ? (
                      props.renderListings(bag.current.category)
                    ) : (
                      <SlotPlaceholder
                        name="renderListings"
                        data-testid="categories-category-listings-slot"
                      />
                    )}
                  </Flex>
                )
              }
            </LoadBoundary>
          </Flex>
        )}
      </CategoryTree>
    </SkinTheme>
  );
}
