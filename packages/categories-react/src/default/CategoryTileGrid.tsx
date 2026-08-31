/**
 * `<CategoryTileGrid>` — the phone landing's category tiles: two rows that
 * scroll sideways, with the third column peeking in so the row reads as
 * scrollable without a scrollbar to say so.
 *
 * ── Why a second surface instead of a prop on the strip ────────────────────
 *
 * `<CategoryCarouselStrip>` is a WRAPPING row of labelled cards — the desktop
 * shape, and it stays exactly what it is. This is a different geometry with a
 * different reading order (a fixed two-row grid, a horizontal scroll port, a
 * tile whose label and art sit in opposite corners), and folding both into one
 * component would mean a `layout` prop nobody could photograph either arm of.
 * They share the one thing worth sharing: the headless `<CategoryCarousel>`
 * bag, so both rows are the same categories in the same order.
 *
 * ── The image seam is the strip's seam, unchanged ──────────────────────────
 *
 * `carousel_icon` / `catalog_icon` are OPAQUE STRINGS the backend deliberately
 * does not resolve. This skin builds no URL and renders no `<img>`: it hands
 * the reference to the host through `renderIcon` — the SAME contract
 * `<CategoryCarouselStrip>` takes, so a storefront wires its CDN resolver once
 * and both surfaces draw art. What is new here is the ABSENCE arm: a tile with
 * nothing in its art corner reads as a broken tile, so an unresolved reference
 * (no `renderIcon`, or no reference on the row) draws a subtle placeholder
 * glyph. Never a guessed URL, and therefore never a broken image.
 *
 * ── Two sources of rows, one geometry ──────────────────────────────────────
 *
 * By default the rows come from the carousel bag, which answers exactly one
 * question: which categories the operator put on the front page. A CATEGORY
 * landing asks a different one — what is inside THIS category — and its answer
 * is already in the host's hand (`useCategoryTree()`), not on the carousel
 * endpoint. {@link CategoryTileGridProps.entries} is that second source, and
 * when it is given `<CategoryCarousel>` is not mounted at all, so the override
 * costs no request it would then discard.
 *
 * ── Geometry ───────────────────────────────────────────────────────────────
 *
 * Every length is relative to the CONTAINER, not to the viewport: the column
 * is `100% / 2.5` of the scroll port minus one gap, and the tile's height
 * comes from its aspect ratio. A tile sized in viewport pixels is a tile that
 * is the wrong size inside every panel, sheet and column that is not the whole
 * screen — and this row is mounted inside all three.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Skeleton } from "antd";
import { cssVar, fontWeight, radii, spacing } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import { renderCategoryLabel } from "../catalog/labels.js";
import { CategoryCarousel } from "../headless/CategoryCarousel.js";
import type { CarouselEntry } from "../headless/CategoryCarousel.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeModeProp } from "./types.js";

/** Rows in the scroller. Two, per the reference — one row wastes the height a
 * phone has, three makes the tile too small to carry a two-line label. */
const TILE_ROWS = 2;

/**
 * How many columns fit the scroll port. The half is the whole point: a row
 * that ends flush on a column edge looks like the end of the list, and the
 * peeking third tile is what says "there is more to the right" without a
 * scrollbar, an arrow or a hint line.
 */
const VISIBLE_COLUMNS = 2.5;

/** Tile proportions — wider than tall, so a two-line label and the art corner
 * both fit without the row eating the fold. */
const TILE_ASPECT_RATIO = "4 / 3";

/** Lines a tile's label may take before it is clipped. */
const LABEL_LINES = 2;

/** How many tiles the loading arm reserves room for. */
const SKELETON_TILES = [1, 2, 3, 4] as const;

const scrollerStyle: CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridTemplateRows: `repeat(${TILE_ROWS}, auto)`,
  // `100%` is the SCROLL PORT's content box, so the tile is a fraction of the
  // box it was mounted in — see this file's header.
  gridAutoColumns: `calc(100% / ${VISIBLE_COLUMNS} - ${spacing[2]}px)`,
  gap: spacing[2],
  overflowX: "auto",
  overscrollBehaviorX: "contain",
  scrollSnapType: "x proximity",
  // The scroll port is the affordance; a scrollbar over a 2-row tile grid on a
  // phone is chrome that covers the art.
  scrollbarWidth: "none",
};

const tileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  aspectRatio: TILE_ASPECT_RATIO,
  padding: spacing[3],
  borderRadius: radii.lg,
  background: cssVar("surface-sunken"),
  // A tile is a link, and a link that inherits the anchor colour reads as a
  // sentence rather than as a surface.
  color: cssVar("text"),
  scrollSnapAlign: "start",
  overflow: "hidden",
};

const labelStyle: CSSProperties = {
  fontWeight: fontWeight.semibold,
  // Two lines, then an ellipsis: a category name that pushes the art out of
  // the tile is worse than a truncated one.
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: LABEL_LINES,
  overflow: "hidden",
};

const artStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  alignSelf: "flex-end",
  maxWidth: "60%",
  maxHeight: "60%",
};

/**
 * What an unresolved icon reference draws.
 *
 * Not an `<img>` with a guessed `src` (a broken image on every deployment that
 * guessed differently) and not nothing (a tile with an empty corner reads as a
 * tile that failed to load). A muted disc: the tile keeps its shape, and the
 * missing art is visibly missing rather than visibly broken.
 */
function TilePlaceholder(): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-stapel-tile-art="placeholder"
      style={{
        width: "2.5em",
        height: "2.5em",
        borderRadius: radii.full,
        background: cssVar("border-subtle"),
        opacity: 0.5,
      }}
    />
  );
}

function Tile(props: {
  readonly href: string;
  readonly label: string;
  readonly art: ReactNode;
  readonly slug?: string;
  readonly linkComponent?: LinkComponent;
  readonly testId?: string;
}): ReactElement {
  return (
    <CategoryLink
      {...(props.linkComponent !== undefined
        ? { linkComponent: props.linkComponent }
        : {})}
      {...(props.slug !== undefined ? { slug: props.slug } : {})}
      href={props.href}
      style={tileStyle}
    >
      <span
        style={labelStyle}
        {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      >
        {props.label}
      </span>
      <span style={artStyle}>{props.art}</span>
    </CategoryLink>
  );
}

export interface CategoryTileGridProps extends ThemeModeProp, LinkComponentProp {
  /** Path prefix for a tile's link, and the "All" tile's own href. Default
   * `/c` — the same convention `<CategoryCarousel>` and the spec's `/c/:slug`
   * already use. */
  readonly basePath?: string;
  /**
   * Turn an opaque icon reference into something renderable — the same
   * contract `<CategoryCarouselStrip>` takes. Absent, or absent for a row that
   * carries no reference, draws {@link TilePlaceholder}.
   */
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
  /**
   * Lead with a tile linking `basePath` itself (default `true`). Off for a row
   * that is already inside a category, where "All" would point at the
   * catalogue root the visitor just came from.
   */
  readonly allTile?: boolean;
  /**
   * Tiles the HOST supplies, instead of the carousel bag.
   *
   * The bag answers ONE question — "which categories has the operator put on
   * the storefront's front page" (`carousel_enabled`, `GET /categories
   * /carousel/`) — and that is the only question a landing page asks. A
   * CATEGORY page asks a different one: "what is inside this category", whose
   * answer is `useCategoryTree()`'s children, already in the host's hand and
   * not on the carousel endpoint at all. Without this prop the second surface
   * either re-implements the tile geometry or renders the wrong rows, and the
   * tiles on `/c/transport` would be the same five the home page shows.
   *
   * Given, the component asks the server NOTHING: `<CategoryCarousel>` is not
   * mounted, so an override costs no `GET /categories/carousel/` (the request
   * a "swap the bag's data" implementation would still fire and discard). An
   * empty array is a real answer — a category with no children — and draws the
   * same empty state a featureless carousel draws.
   *
   * There is no loading or failed arm for an override, and that is deliberate:
   * the host owns the fetch it drew these rows from, so it owns the two
   * sentences that go with it. Handing this component a `LoadState` would give
   * one load two owners.
   */
  readonly entries?: readonly CarouselEntry[];
}

/** The scroll port itself: the "All" tile, then one tile per row. */
function TileRow(props: {
  readonly entries: readonly CarouselEntry[];
  readonly basePath: string;
  readonly allTile?: boolean;
  readonly linkComponent?: LinkComponent;
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
}): ReactElement {
  const t = useT();
  const linkProps =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};
  return (
    <div style={scrollerStyle} data-testid="categories-tile-grid-list">
      {props.allTile !== false && (
        <Tile
          {...linkProps}
          href={props.basePath}
          label={t(CATEGORIES_I18N_KEYS.tilesAll)}
          art={<TilePlaceholder />}
          testId="categories-tile-grid-all"
        />
      )}
      {props.entries.map((entry) => (
        <Tile
          key={entry.category.id}
          {...linkProps}
          href={entry.href}
          slug={entry.category.slug}
          label={renderCategoryLabel(entry.label, t)}
          art={
            entry.icon !== null && props.renderIcon !== undefined ? (
              props.renderIcon(entry.icon, entry)
            ) : (
              <TilePlaceholder />
            )
          }
        />
      ))}
    </div>
  );
}

export function CategoryTileGrid(props: CategoryTileGridProps): ReactElement {
  const t = useT();
  const basePath = props.basePath ?? "/c";
  const rowProps = {
    basePath,
    ...(props.allTile !== undefined ? { allTile: props.allTile } : {}),
    ...(props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {}),
    ...(props.renderIcon !== undefined ? { renderIcon: props.renderIcon } : {}),
  };
  const override = props.entries;

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <nav
        aria-label={t(CATEGORIES_I18N_KEYS.carouselTitle)}
        data-testid="categories-tile-grid"
      >
        {override !== undefined ? (
          // The override arm asks the server nothing — see `entries`.
          override.length === 0 ? (
            <EmptyState
              testId="categories-tile-grid-empty"
              compact
              title={t(CATEGORIES_I18N_KEYS.carouselEmpty)}
            />
          ) : (
            <TileRow {...rowProps} entries={override} />
          )
        ) : (
          <CategoryCarousel basePath={basePath}>
            {(bag) => (
              <LoadList
                state={bag.state}
                testId="categories-tile-grid"
                onRetry={bag.refetch}
                loading={
                  <div style={scrollerStyle}>
                    {SKELETON_TILES.map((slot) => (
                      <Skeleton.Button
                        key={slot}
                        active
                        block
                        style={{ aspectRatio: TILE_ASPECT_RATIO, height: "auto" }}
                      />
                    ))}
                  </div>
                }
                failed={(error) => (
                  <ErrorAlert
                    testId="categories-tile-grid-failed"
                    thrown={error}
                    message={t(CATEGORIES_I18N_KEYS.carouselLoadFailed)}
                    onRetry={bag.refetch}
                  />
                )}
                empty={
                  <EmptyState
                    testId="categories-tile-grid-empty"
                    compact
                    title={t(CATEGORIES_I18N_KEYS.carouselEmpty)}
                  />
                }
              >
                {(entries) => <TileRow {...rowProps} entries={entries} />}
              </LoadList>
            )}
          </CategoryCarousel>
        )}
      </nav>
    </SkinTheme>
  );
}
