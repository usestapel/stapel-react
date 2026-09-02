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
 * (no `renderIcon`, or no reference on the row) draws the category's own
 * initial as {@link TileMonogram}. Never a guessed URL, and therefore never a
 * broken image.
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
 * ── Where tiles STOP ───────────────────────────────────────────────────────
 *
 * Tiles are the top level and a top-level category's children, and nothing
 * deeper: below that a category is a CHARACTERISTIC, chosen through cascading
 * child selectors when filtering or posting, not a tile a person navigates
 * into. {@link CategoryTileGridProps.categoryDepth} is how a landing says
 * which depth it is at, and past the cap this component renders NOTHING at
 * all — not an empty state, because there is no absence to report: the
 * sub-categories exist, they are simply offered somewhere else, in a different
 * shape. The number itself lives in `catalog/tiles.ts` so the search and
 * composer surfaces read the same one.
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
import { categoryOffersTileGrid } from "../catalog/tiles.js";
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

/**
 * The COMPACT geometry, in two numbers (the owner's ruling on tile size,
 * 2026-09-02: the cozy tiles were "huge" at 390px and a fraction-of-container
 * column turned a 1440px catalogue page into a wall of ~550px tiles).
 *
 * More visible columns makes the phone row dense — a 390px port shows four
 * tiles and the peek of a fifth. The PIXEL CAP is the desktop half of the
 * same fix: the column is `min(fraction, cap)`, so a wide container gets a
 * modest strip of 128px tiles instead of inflating the fraction into
 * billboards. Both numbers stay relative to the CONTAINER first — the cap
 * only stops the growth, it never stretches a narrow port.
 */
const COMPACT_VISIBLE_COLUMNS = 4.4;
const COMPACT_MAX_COLUMN_PX = 128;

/** The two tile geometries a host can ask for. `cozy` is the reference
 * two-row scroller; `compact` is the dense strip — see the constants above. */
export type TileDensity = "cozy" | "compact";

/** Tile proportions — wider than tall, so a two-line label and the art corner
 * both fit without the row eating the fold. */
const TILE_ASPECT_RATIO = "4 / 3";

/**
 * Lines a tile's label may take before it is clipped.
 *
 * Three, not the original two, and with hyphenation below — measured on a
 * live 390px classified catalogue: the tile's inner column is ~105px there,
 * one root name is a single 12-letter word wider than that (the clamp
 * ellipsized it on its FIRST line), and the longest root name is three lines
 * of text however it breaks. Real root names in a hyphenating language need
 * the third line more than the art corner needs the headroom.
 */
const LABEL_LINES = 3;

/** How many tiles the loading arm reserves room for. */
const SKELETON_TILES = [1, 2, 3, 4] as const;

const scrollerBase: CSSProperties = {
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

/** The compact delta: denser columns AND the absolute cap that keeps a wide
 * container honest — see the constants above. */
const scrollerCompact: CSSProperties = {
  ...scrollerBase,
  gridAutoColumns: `min(calc(100% / ${COMPACT_VISIBLE_COLUMNS} - ${spacing[2]}px), ${COMPACT_MAX_COLUMN_PX}px)`,
};

function scrollerStyle(density: TileDensity): CSSProperties {
  return density === "compact" ? scrollerCompact : scrollerBase;
}

const tileBase: CSSProperties = {
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

// A dense tile keeps its whole area for the label and the art.
const tileCompact: CSSProperties = { ...tileBase, padding: spacing[2] };

function tileStyle(density: TileDensity): CSSProperties {
  return density === "compact" ? tileCompact : tileBase;
}

/** Compact label: the same clamp at the skin's small size — an ~80px tile
 * cannot spend body-size lines and still show its art corner. */
const COMPACT_LABEL_FONT_SIZE = 12;

const labelStyle: CSSProperties = {
  fontWeight: fontWeight.semibold,
  // The clamp, then an ellipsis: a category name that pushes the art out of
  // the tile is worse than a truncated one.
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: LABEL_LINES,
  overflow: "hidden",
  // A touch tighter than the skin's body line: three clamped lines are a
  // label, not a paragraph, and the saved height is what keeps the art corner
  // inside the tile at the measured 129×97 phone geometry.
  lineHeight: 1.3,
  // A word wider than the tile breaks like a book word instead of clipping:
  // `hyphens` under the document's own `lang`, and `overflow-wrap` as the
  // floor for a browser without that language's dictionary.
  hyphens: "auto",
  overflowWrap: "anywhere",
};

const labelCompact: CSSProperties = {
  ...labelStyle,
  fontSize: COMPACT_LABEL_FONT_SIZE,
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
 * What a tile draws in its art corner when there is no art.
 *
 * ── Why a monogram and not a disc ──────────────────────────────────────────
 *
 * The first version of this drew a muted circle, on the reasoning that a tile
 * with an empty corner reads as a tile that failed to load. It does — and so
 * does the circle. A live catalogue put nine of them on one landing (every
 * category on that deployment carries `carousel_icon: ""`, which is the state
 * every catalogue is in until somebody uploads art), and a grid of identical
 * grey discs reads as nine images still loading, not as a design.
 *
 * A letter cannot be mistaken for a pending image. It is also not a guess: the
 * category's own initial is information the tile already has and already
 * shows, set large and faint so it sits behind the label as texture rather
 * than competing with it as a second reading. Every tile then differs from
 * every other tile, which is the property the discs lacked.
 *
 * Still never an `<img>` with an invented `src` — the reason the art seam is a
 * host callback in the first place (see this file's header).
 *
 * `aria-hidden`, because it is the label's first letter: a screen reader that
 * announced it would read the category's name and then its initial.
 */
function TileMonogram(props: { readonly label: string }): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-stapel-tile-art="monogram"
      style={{
        // `Intl.Segmenter` would be the pedantic way to take one grapheme, and
        // it is not worth a polyfill here: the fallback is decorative, and a
        // label whose first code point is half a surrogate pair renders the
        // replacement glyph in a corner nobody reads letters from.
        fontSize: "2.25em",
        lineHeight: 1,
        fontWeight: fontWeight.bold,
        color: cssVar("text"),
        // Faint enough to stay behind the label at any tile size, dark enough
        // to survive the sunken surface in both themes.
        opacity: 0.14,
        userSelect: "none",
      }}
    >
      {firstLetter(props.label)}
    </span>
  );
}

/** The one character a monogram shows: the label's first letter, uppercased
 * in the label's OWN locale rules — `toLocaleUpperCase` and not
 * `toUpperCase`, so a Turkish `i` becomes `İ` rather than `I`. */
function firstLetter(label: string): string {
  const [first] = [...label.trim()];
  return first === undefined ? "" : first.toLocaleUpperCase();
}

function Tile(props: {
  readonly href: string;
  readonly label: string;
  readonly art: ReactNode;
  readonly slug?: string;
  readonly categoryId?: number;
  readonly linkComponent?: LinkComponent;
  readonly testId?: string;
  readonly density: TileDensity;
}): ReactElement {
  return (
    <CategoryLink
      {...(props.linkComponent !== undefined
        ? { linkComponent: props.linkComponent }
        : {})}
      {...(props.slug !== undefined ? { slug: props.slug } : {})}
      {...(props.categoryId !== undefined
        ? { categoryId: props.categoryId }
        : {})}
      href={props.href}
      style={tileStyle(props.density)}
    >
      <span
        style={props.density === "compact" ? labelCompact : labelStyle}
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
   * carries no reference, draws {@link TileMonogram}.
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
  /**
   * The 0-indexed depth of the category whose children these tiles are — a
   * top-level category is `0`, its child is `1`. Omitted means the catalogue
   * ROOT (the home screen), which is above every category and always offers
   * tiles.
   *
   * Past {@link MAX_TILE_DEPTH} this component renders nothing: the deeper
   * levels of the tree are characteristics chosen through cascading selectors,
   * not tiles (see this file's header). The rows are NOT lost — the host still
   * has them, and a list, a breadcrumb or a selector may render them.
   */
  readonly categoryDepth?: number;
  /**
   * Tile geometry (default `"cozy"`, the reference two-row scroller).
   * `"compact"` is the dense strip: 4+ visible columns and an absolute cap on
   * the column width, so the same mount is small on a phone and a modest
   * strip — never a wall — inside a wide desktop column.
   */
  readonly density?: TileDensity;
}

/** The scroll port itself: the "All" tile, then one tile per row. */
function TileRow(props: {
  readonly entries: readonly CarouselEntry[];
  readonly basePath: string;
  readonly allTile?: boolean;
  readonly linkComponent?: LinkComponent;
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
  readonly density: TileDensity;
}): ReactElement {
  const t = useT();
  const linkProps =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};
  return (
    <div style={scrollerStyle(props.density)} data-testid="categories-tile-grid-list">
      {props.allTile !== false && (() => {
        const allLabel = t(CATEGORIES_I18N_KEYS.tilesAll);
        return (
          <Tile
            {...linkProps}
            density={props.density}
            href={props.basePath}
            label={allLabel}
            art={<TileMonogram label={allLabel} />}
            testId="categories-tile-grid-all"
          />
        );
      })()}
      {props.entries.map((entry) => {
        const label = renderCategoryLabel(entry.label, t);
        return (
          <Tile
            key={entry.category.id}
            {...linkProps}
            density={props.density}
            href={entry.href}
            slug={entry.category.slug}
            categoryId={entry.category.id}
            label={label}
            art={
              entry.icon !== null && props.renderIcon !== undefined ? (
                props.renderIcon(entry.icon, entry)
              ) : (
                <TileMonogram label={label} />
              )
            }
          />
        );
      })}
    </div>
  );
}

export function CategoryTileGrid(
  props: CategoryTileGridProps
): ReactElement | null {
  const t = useT();
  const basePath = props.basePath ?? "/c";
  // Before any load: past the cap there are no tiles to ask for, so the
  // carousel bag is never mounted and the request it would make is never
  // fired. A component that fetched and then hid the answer would pay for
  // rows nobody may see.
  const offersTiles = categoryOffersTileGrid(props.categoryDepth);
  const density: TileDensity = props.density ?? "cozy";
  const rowProps = {
    basePath,
    density,
    ...(props.allTile !== undefined ? { allTile: props.allTile } : {}),
    ...(props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {}),
    ...(props.renderIcon !== undefined ? { renderIcon: props.renderIcon } : {}),
  };
  const override = props.entries;

  if (!offersTiles) return null;

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
                  <div style={scrollerStyle(density)}>
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
