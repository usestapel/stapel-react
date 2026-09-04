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
 *   categoryId={id}
 *   renderListings={(category) => (
 *     <SearchPage adapter={useRouterSearchParams()} defaultType="listing"
 *                 defaultCategory={pathOf(category)} />
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
 * ── Two ways in, and only one of them is cheap ─────────────────────────────
 *
 * `categoryId` is the fast address: `GET {id}/` and `GET {id}/children/`, two
 * small answers, no catalogue. `slug` is the SEO address and it cannot be
 * resolved without one — `stapel-categories` never overrides `lookup_field`
 * and its list takes no `slug` filter, so a bare slug still costs the whole
 * table (measured on a live classified deployment: 36 requests, 1.4 MB, 23.4 s
 * cold, against 0.6 s for the id). The gap is recorded in MODULE.md as an
 * upstream ask; until it closes, a host that KNOWS the id — every in-app
 * navigation does, because it drew the link — should say so, and this page
 * takes both so that it can.
 *
 * When both are given the id wins and the slug is decoration — EVERYWHERE on
 * the page, and the qualifier is there because it was earned. The `"pane"`
 * arm used to fall back to `<CategoryTreePane slug>` whenever a slug was on
 * the props, resolving it through the catalogue sync for a level the id path
 * had ALREADY loaded to gate the page: on a live classified deployment that
 * was 13.2 seconds of skeletons under "Subcategories" on a cold desktop
 * landing, while the same host's list page drew the widget in 0.4 s from
 * per-level reads. The arm now renders the rows in hand and asks one small
 * cached children read per row for the counts; the catalogue is paid for only
 * by a host that truly has nothing but a slug.
 *
 * ── One form of sub-categories, chosen here ────────────────────────────────
 *
 * The sub-category menu used to be a titled LIST and nothing else, with no way
 * to ask for anything different. A host that wanted the reference design's
 * TILES therefore mounted `<CategoryTileGrid>` alongside this page and hid the
 * list with its own stylesheet — which a live classified deployment did: on a
 * 390px viewport both `categories-tree-list` and `categories-tile-grid-list`
 * were in the DOM, the same links rendered twice, one of them invisible. A
 * host hiding a pair's output with CSS is the pair's bug: the page rendered
 * something the host could not decline.
 *
 * {@link CategoryPageProps.subcategories} is that decision, taken once and
 * rendered once. The arm that is not chosen is not MOUNTED — it does not
 * render hidden, and its testid is absent from the document, which is what
 * makes "one list" checkable rather than a claim about stylesheets.
 *
 * ── WHERE THE TILES STOP, AND WHAT STARTS THERE ────────────────────────────
 *
 * The `"tiles"` arm used to render NOTHING past the catalogue's depth cap, on
 * the correct rule that a category below level 2 is chosen as a characteristic
 * rather than navigated into — and on the incorrect assumption that something
 * else was offering that choice. Nothing was. The measured consequence on a
 * live classified catalogue was total: `/c/transport` drew 5 tiles,
 * `/c/transport-avtomobili` drew **0**, and 2924 of 2924 active leaves — every
 * category that has any characteristics at all — could not be reached from a
 * phone by browsing. The same URL at 1440px showed a "Subcategories" list and
 * got there in three taps, so half the product could descend and half could
 * not.
 *
 * Past the cap the arm now hands over to `<CategoryCascadeField>`, which is
 * the control the owner's model names: cascading child selectors, the same
 * gesture as `Make → Model`, the same component the composer and the filter
 * rail mount. Tiles stop; the ladder starts; nothing is unreachable. The
 * handover is one `GET {id}/children/` per rung, so it costs a fraction of a
 * second and never the catalogue.
 *
 * {@link CategoryPageProps.breadcrumbs} is the CSS defect one row up, and it
 * was hidden by the same stylesheet: a phone landing in the reference design
 * is back-arrow, search field and tiles, so the trail belongs to the back
 * arrow and a crumb row above the title is desktop furniture. Same rule, same
 * reason — the host STATES it and the bar is never mounted, rather than being
 * rendered and then covered.
 */
import { spacing } from "@stapel/tokens";
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import {
  SlotPlaceholder,
  loadStateFromQuery,
  loadedRowsOrEmpty,
  mapLoad,
  useT,
} from "@stapel/core";
import type { LinkComponent, LoadState } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { Category } from "../api/types.js";
import { categoryAncestorChain } from "../catalog/cascade.js";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import { browseStage } from "../catalog/stage.js";
import { resolveCategorySlug } from "../catalog/tree.js";
import { categoryTileEntry } from "../headless/CategoryCarousel.js";
import type { CarouselEntry } from "../headless/CategoryCarousel.js";
import {
  useCategory,
  useCategoryCatalog,
  useCategoryChildren,
  useCategoryLevels,
} from "../model/queries.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryBreadcrumbsBar } from "./CategoryBreadcrumbsBar.js";
import { CategoryCascadeField } from "./CategoryCascadeField.js";
import { CategoryFeatureList } from "./CategoryFeatureList.js";
import { CategoryTileGrid } from "./CategoryTileGrid.js";
import type {
  CategoryIconResolver,
  TileDensity,
  TileLayout,
} from "./CategoryTileGrid.js";
import { CategoryLevelList } from "./CategoryLevelList.js";
import { CategoryTreePane } from "./CategoryTreePane.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import type { ThemeModeProp } from "./types.js";

/**
 * How wide a catalogue screen may get, by default. Without one, a 1280px
 * window put the "2 subcategories" chip ~2,300px from the label it counts and
 * left more than 90% of the page empty. A host that wants a different measure
 * passes {@link CategoryPageProps.measure} rather than overriding this value's
 * `max-width` from outside with `!important`.
 */
export const CATEGORY_MEASURE = "64rem";

/** What a heading callback is told about the page it is titling. */
export interface CategoryHeadingContext {
  /** The resolved category — the row the page drew its own title from. */
  readonly category: Category;
  /**
   * How many SUB-CATEGORIES this page has in hand, which is the only count
   * this pair owns. A results count belongs to the listings pair and is
   * already in the host's own state, which is the reason this slot takes a
   * node at all.
   */
  readonly count?: number;
}

/**
 * The page's title, host-supplied.
 *
 * A node, or a function of {@link CategoryHeadingContext} for a host that
 * wants the category and the page's own count without resolving the slug a
 * second time. Either way it replaces the CONTENT of the page's heading and
 * not the heading itself: one `<h*>` in the document, in the same place, with
 * the host's sentence inside it — a storefront that needs "Buy a car in Sochi
 * · 54 364" gets it without drawing a second heading above the page's and
 * leaving two in the outline.
 */
export type CategoryHeading =
  | ReactNode
  | ((ctx: CategoryHeadingContext) => ReactNode);

export interface CategoryPageProps extends ThemeModeProp, LinkComponentProp {
  /**
   * Replace the page's heading text — see {@link CategoryHeading}. Omitted,
   * the page renders the category's own translated name, which is what it has
   * always rendered.
   */
  readonly heading?: CategoryHeading;
  /**
   * The category, by id — the address that costs two small requests. Every
   * in-app navigation has it, because it drew the link that got here.
   */
  readonly categoryId?: number | null;
  /**
   * The `:slug` segment of `/c/:slug` — the SEO address, resolved against the
   * synced catalogue because the server offers no slug lookup. Ignored when
   * `categoryId` is given. See this file's header.
   */
  readonly slug?: string;
  readonly basePath?: string;
  /** The listings half of the screen — supplied by the container, because it
   * belongs to another pair. Unfilled, the gap NAMES itself in development
   * (see this file's header). */
  readonly renderListings?: (category: Category) => ReactNode;
  /** Show the category's feature schema. Off by default: on a storefront the
   * schema is the facet panel's input, not a visitor-facing table. */
  readonly showFeatures?: boolean;
  /**
   * Draw the trail above the title. Default `true` — what this page has always
   * rendered, so no existing host changes behaviour.
   *
   * NOT a taste knob, and the reason matters because the next reader will
   * otherwise assume it is one. Which chrome carries "where am I" is a
   * DEPLOYMENT'S navigation decision, and the two answers are both correct:
   *
   *  - on a desktop the trail IS the catalogue's navigation — it is how a
   *    visitor moves back up a tree that has no other affordance on screen;
   *  - on a phone the reference design gives that job to the back arrow in
   *    the app bar, above a landing that is search field and tiles. A crumb
   *    row there repeats the back arrow in a second visual language and
   *    spends a line of a fold that has four of them.
   *
   * `false` mounts NOTHING — the bar is absent from the document rather than
   * covered — which is the same rule the sub-category arms follow and the only
   * version of this a test can check.
   */
  readonly breadcrumbs?: boolean;
  /**
   * Which FORM the sub-categories take. Default `"pane"` — what this page has
   * always rendered, so no existing host changes behaviour.
   *
   * Exactly one arm is mounted; see this file's header for the defect that
   * made this a prop rather than a stylesheet.
   */
  readonly subcategories?: SubcategoryForm;
  /**
   * Tile geometry for the `"tiles"` arm — `<CategoryTileGrid density>`,
   * passed through verbatim. Ignored by the `"pane"` arm, which has no tiles
   * to size. Default is the grid's own (`"cozy"`).
   */
  readonly subcategoryTileDensity?: TileDensity;
  /**
   * How the `"tiles"` arm fills its container — `<CategoryTileGrid layout>`,
   * passed through verbatim. Ignored by every other {@link SubcategoryForm}.
   *
   * Default unchanged: the grid's own `"scroll"`, so no existing host
   * changes shape. A desktop category landing with a handful of children
   * (5 tiles in a 1232px column, say) reads as an empty corner under
   * `"scroll"`'s phone-width scroller — `"wrap"` is the fix, the same tiles
   * stretched to fill the row like the reference design.
   */
  readonly subcategoryLayout?: TileLayout;
  /**
   * The `"tiles"` arm's `minTileWidth` under `subcategoryLayout="wrap"` —
   * `<CategoryTileGrid minTileWidth>`, passed through verbatim. Ignored by
   * `"scroll"` and by every other {@link SubcategoryForm}.
   */
  readonly subcategoryMinTileWidth?: number;
  /**
   * A narrowing made in the cascade below the tiles.
   *
   * The page does not own where that goes — the results are another pair's,
   * and only the container knows whether a narrowing belongs in the URL, in a
   * search state or in both. So it is reported, not applied. `null` is the
   * cascade being cleared back to this landing.
   */
  readonly onNarrow?: (category: Category | null) => void;
  /** The narrowing the host currently holds, for a controlled cascade. */
  readonly narrowValue?: number | null;
  /**
   * Turn a tile's opaque icon reference into something renderable — the same
   * contract `<CategoryTileGrid>` and `<CategoryCarouselStrip>` take, and
   * meaningful only on the `"tiles"` arm. Absent, a tile draws the category's
   * own initial; this page never builds a URL out of a reference.
   */
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
  /**
   * Address a tile's opaque reference without projecting the rows — forwarded
   * verbatim to `<CategoryTileGrid>`, and meaningful only on the `"tiles"`
   * arm. See `CategoryIconResolver`.
   */
  readonly resolveIconSrc?: CategoryIconResolver;
  /**
   * How wide the page's own content column may get — the `max-width` this
   * file's header explains ({@link CATEGORY_MEASURE}'s own default).
   *
   * Without a prop a host that wanted a different measure had to override it
   * with `!important` from outside, against a value it could not read back —
   * this is that knob, taking anything CSS `max-width` takes (`"72rem"`,
   * `960`, `"100%"`). Default {@link CATEGORY_MEASURE}, so no existing host
   * changes shape.
   */
  readonly measure?: number | string;
}

/**
 * How a category page offers what is inside it.
 *
 * `"pane"`     a titled LIST of links — the default, and the only shape this
 *              page had. Drawn from the level the id path already holds, or
 *              by `<CategoryTreePane>` for a slug-only host; one shared row
 *              markup either way (see this file's header).
 * `"tiles"`    the reference design's tile grid within the catalogue's depth
 *              cap (`catalog/tiles.ts`), and past it the CASCADE the cap hands
 *              over to. One arm, two halves of one navigation model.
 * `"cascade"`  the cascading child selectors at every depth, tiles never. For
 *              a host that draws its own tiles above this page.
 * `"none"`     neither. For a host that draws its own sub-category chrome and
 *              wants the rest of this page.
 */
export type SubcategoryForm = "pane" | "tiles" | "cascade" | "none";

/** What the two addresses resolve to, in one shape. */
interface CategoryPageSource {
  /** `loading` until the landing category itself is known. */
  readonly state: LoadState<null>;
  readonly current: Category | null;
  readonly children: readonly Category[];
  /** The landing's own 0-indexed depth — from `tn_ancestors_pks` on the id
   * path, from the built node on the slug path. `null` while unknown. */
  readonly depth: number | null;
  /** The address named nothing. Only ever `true` once a read succeeded. */
  readonly unknown: boolean;
  refetch(): void;
}

/**
 * Resolve the landing, by id (two small reads) or by slug (the catalogue).
 *
 * Both hooks are always called and one of them is always disabled — a
 * disabled TanStack query issues no request, stores nothing and reads
 * nothing, which is what makes "the id path never transfers the catalogue" a
 * property of the code rather than of the render order.
 */
function useCategoryPageSource(props: {
  readonly categoryId?: number | null;
  readonly slug?: string;
}): CategoryPageSource {
  const byId = props.categoryId !== null && props.categoryId !== undefined;
  const id = byId ? (props.categoryId as number) : null;

  const rowQuery = useCategory(id);
  const childrenQuery = useCategoryChildren(id);
  const catalogQuery = useCategoryCatalog({ enabled: !byId });

  if (byId) {
    const row = rowQuery.data ?? null;
    const childrenState = loadStateFromQuery(childrenQuery);
    // BOTH reads gate the page, and the children one is not optional: a page
    // that went `ready` on the row alone would draw "no sub-categories" for a
    // third of a second on every category that has some.
    const state: LoadState<null> =
      rowQuery.error != null
        ? { status: "failed", error: rowQuery.error }
        : childrenState.status === "failed"
          ? childrenState
          : row === null || childrenState.status !== "ready"
            ? { status: "loading" }
            : { status: "ready", data: null };
    return {
      state,
      current: row,
      children: loadedRowsOrEmpty(childrenState),
      depth: row === null ? null : categoryAncestorChain(row).length,
      // An id that is not a category is a 404 from the server, which arrives
      // as `failed`. There is no "read succeeded and named nothing" here.
      unknown: false,
      refetch: () => {
        void rowQuery.refetch();
        void childrenQuery.refetch();
      },
    };
  }

  const catalog = loadStateFromQuery(catalogQuery);
  const index = catalog.status === "ready" ? catalog.data.index : null;
  const node =
    index !== null && props.slug !== undefined
      ? (resolveCategorySlug(index, props.slug) ?? null)
      : null;
  return {
    state: mapLoad(catalog, () => null),
    current: node?.category ?? null,
    children: node?.children.map((child) => child.category) ?? [],
    depth: node?.depth ?? null,
    unknown: catalog.status === "ready" && node === null,
    refetch: () => {
      void catalogQuery.refetch();
    },
  };
}

/**
 * The `"pane"` arm on the ID PATH: the titled list, from the rows the page
 * already holds.
 *
 * `useCategoryPageSource` gated the page on `GET {id}/children/`, so by the
 * time this mounts the level is IN HAND — the only thing the catalogue could
 * still add is the per-row "N subcategories" chip, and that is one small
 * cached children read per row (`useCategoryLevels`), the same rung a cascade
 * or the next landing reads. The rows render immediately; a chip whose read
 * has not landed (or refused) draws nothing — no Tag, no chevron, no zero
 * standing in for an unknown. When it lands as >0 it draws exactly what the
 * catalogue path draws, because both arms render `<CategoryLevelList>`.
 *
 * A component rather than a branch inside `Subcategories`, because the arm is
 * conditional and the fan-out is a hook: mounting and unmounting WITH the arm
 * is what keeps the reads from firing under `"tiles"` or `"none"`.
 */
function SubcategoryLevelPane(props: {
  readonly childRows: readonly Category[];
  readonly basePath: string;
  readonly linkComponent?: LinkComponent;
}): ReactElement {
  const t = useT();
  const ids = props.childRows.map((row) => row.id);
  const counts = useCategoryLevels(ids);
  return (
    <Flex vertical gap={spacing[2]} data-testid="categories-tree">
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t(CATEGORIES_I18N_KEYS.categorySubcategories)}
      </Typography.Title>
      <CategoryLevelList
        {...(props.linkComponent !== undefined
          ? { linkComponent: props.linkComponent }
          : {})}
        rows={props.childRows}
        childCount={(row) => {
          const level = counts.rows[ids.indexOf(row.id)];
          return level == null ? null : level.length;
        }}
        basePath={props.basePath}
      />
    </Flex>
  );
}

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
  readonly current: Category;
  readonly depth: number;
  /** Named `childRows`, not `children`: a prop called `children` on a React
   * component IS the element's children, and an array of category rows put
   * there would be rendered as content instead of read as data. */
  readonly childRows: readonly Category[];
  /**
   * Which address resolved `childRows`. `true` = the id path: the rows are
   * `GET {id}/children/`, already paid for, and the pane arm renders them
   * directly. `false` = the catalogue built them for a slug-only host, and
   * the pane arm keeps `<CategoryTreePane>`, whose sync is by then a cache
   * hit. The distinction cannot be read off `slug` — hosts pass BOTH
   * addresses, and choosing by slug is the 13-second defect (see the header).
   */
  readonly rowsFromId: boolean;
  readonly slug?: string;
  readonly basePath: string;
  readonly linkComponent?: LinkComponent;
  readonly onNarrow?: (category: Category | null) => void;
  readonly narrowValue?: number | null;
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
  readonly resolveIconSrc?: CategoryIconResolver;
  readonly tileDensity?: TileDensity;
  readonly tileLayout?: TileLayout;
  readonly tileMinWidth?: number;
}): ReactElement | null {
  const t = useT();
  const link =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};

  if (props.form === "none") return null;
  if (props.childRows.length === 0) return null;

  const cascade = (
    <Flex vertical gap={spacing[2]}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t(CATEGORIES_I18N_KEYS.categorySubcategories)}
      </Typography.Title>
      <CategoryCascadeField
        rootId={props.current.id}
        commit="any"
        verdict={false}
        {...(props.narrowValue !== undefined
          ? { value: props.narrowValue }
          : {})}
        {...(props.onNarrow !== undefined
          ? { onChange: (_id: number | null, row: Category | null) => {
              props.onNarrow?.(row);
            } }
          : {})}
      />
    </Flex>
  );

  if (props.form === "cascade") return cascade;

  if (props.form === "tiles") {
    // Past a root the tiles hand over to the ladder rather than to nothing —
    // see this file's header for the 2924 leaves that answer used to hide.
    // `browseStage` is the same call the browse contract's two-level rule
    // names everywhere else, so this arm's own choice cannot drift from it.
    if (browseStage(props.current) !== "tiles") return cascade;
    return (
      <Flex vertical gap={spacing[2]}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t(CATEGORIES_I18N_KEYS.categorySubcategories)}
        </Typography.Title>
        <CategoryTileGrid
          {...link}
          {...(props.tileDensity !== undefined
            ? { density: props.tileDensity }
            : {})}
          {...(props.tileLayout !== undefined
            ? { layout: props.tileLayout }
            : {})}
          {...(props.tileMinWidth !== undefined
            ? { minTileWidth: props.tileMinWidth }
            : {})}
          {...(props.renderIcon !== undefined
            ? { renderIcon: props.renderIcon }
            : {})}
          {...(props.resolveIconSrc !== undefined
            ? { resolveIconSrc: props.resolveIconSrc }
            : {})}
          basePath={props.basePath}
          categoryDepth={props.depth}
          // Already inside a category: an "All" tile here points at the
          // catalogue root the visitor has just come from.
          allTile={false}
          entries={props.childRows.map((row) =>
            categoryTileEntry(row, props.basePath)
          )}
        />
      </Flex>
    );
  }

  // The id path already holds this level — mounting the pane here would
  // resolve the slug through the full catalogue sync for rows that are
  // sitting in `childRows`, which is the 13-second defect in the header.
  if (props.rowsFromId) {
    return (
      <SubcategoryLevelPane
        childRows={props.childRows}
        basePath={props.basePath}
        {...link}
      />
    );
  }
  if (props.slug === undefined) return cascade;
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
  const source = useCategoryPageSource({
    ...(props.categoryId !== undefined ? { categoryId: props.categoryId } : {}),
    ...(props.slug !== undefined ? { slug: props.slug } : {}),
  });

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex
        vertical
        gap={spacing[4]}
        style={{ padding: spacing[4], maxWidth: props.measure ?? CATEGORY_MEASURE }}
        data-testid="categories-category-page"
      >
        {/* The page owns the outage and the dead address; the bar under
            the same read must not state either a second time in a second
            visual language. */}
        {props.breadcrumbs === false ? null : (
          <CategoryBreadcrumbsBar
            {...(props.categoryId !== null && props.categoryId !== undefined
              ? { categoryId: props.categoryId }
              : props.slug !== undefined
                ? { slug: props.slug }
                : {})}
            basePath={base}
            onAbsent="quiet"
            {...link}
          />
        )}

        <LoadBoundary
          state={source.state}
          testId="categories-category"
          onRetry={source.refetch}
          skeletonRows={4}
          failed={(error) => (
            // The substrate's default arm would say "something went
            // wrong"; this pair knows WHICH thing, and keeps the
            // technical detail core split off beside it.
            <ErrorAlert
              testId="categories-category-failed"
              thrown={error}
              message={t(CATEGORIES_I18N_KEYS.catalogLoadFailed)}
              onRetry={source.refetch}
            />
          )}
        >
          {() =>
            source.current === null ? (
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
                <Typography.Title
                  level={3}
                  style={{ margin: 0 }}
                  data-testid="categories-category-title"
                >
                  {props.heading === undefined
                    ? renderCategoryLabel(categoryLabel(source.current), t)
                    : typeof props.heading === "function"
                      ? props.heading({
                          category: source.current,
                          count: source.children.length,
                        })
                      : props.heading}
                </Typography.Title>

                <Subcategories
                  form={props.subcategories ?? "pane"}
                  rowsFromId={
                    props.categoryId !== null && props.categoryId !== undefined
                  }
                  {...(props.subcategoryTileDensity !== undefined
                    ? { tileDensity: props.subcategoryTileDensity }
                    : {})}
                  {...(props.subcategoryLayout !== undefined
                    ? { tileLayout: props.subcategoryLayout }
                    : {})}
                  {...(props.subcategoryMinTileWidth !== undefined
                    ? { tileMinWidth: props.subcategoryMinTileWidth }
                    : {})}
                  current={source.current}
                  depth={source.depth ?? 0}
                  childRows={source.children}
                  {...(props.slug !== undefined ? { slug: props.slug } : {})}
                  basePath={base}
                  {...link}
                  {...(props.onNarrow !== undefined
                    ? { onNarrow: props.onNarrow }
                    : {})}
                  {...(props.narrowValue !== undefined
                    ? { narrowValue: props.narrowValue }
                    : {})}
                  {...(props.renderIcon !== undefined
                    ? { renderIcon: props.renderIcon }
                    : {})}
                  {...(props.resolveIconSrc !== undefined
                    ? { resolveIconSrc: props.resolveIconSrc }
                    : {})}
                />

                {props.showFeatures === true ? (
                  <CategoryFeatureList categoryId={source.current.id} />
                ) : null}

                {props.renderListings !== undefined ? (
                  props.renderListings(source.current)
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
    </SkinTheme>
  );
}
