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
 * does not resolve, so this skin never BUILDS one: it hands the reference to
 * the host through `renderIcon` — the SAME contract
 * `<CategoryCarouselStrip>` takes, so a storefront wires its CDN resolver once
 * and both surfaces draw art. Where the reference already IS an address (a
 * seeded catalogue writes the uploaded asset's URL into `catalog_icon`) the
 * tile draws it, and where it is neither the tile draws the category's own
 * initial as {@link TileMonogram} — a tile with nothing in its art corner
 * reads as a broken tile. Never a guessed URL, and therefore never a broken
 * image; the order and the reasoning are on {@link tileArt}.
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
 *
 * `layout="wrap"` keeps that rule and drops the scroll port: the columns come
 * from `minmax(min(minTileWidth, 100%), 1fr)`, so the tiles wrap onto as many
 * lines as the container needs and none of them is off screen.
 */
import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Flex, Input, List, Skeleton } from "antd";
import { cssVar, fontWeight, radii, spacing } from "@stapel/tokens-antd";
import { STAPEL_UI_KEYS, useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import type { Category } from "../api/types.js";
import { renderCategoryLabel } from "../catalog/labels.js";
import { categoryIconSrc, categoryOffersTileGrid } from "../catalog/tiles.js";
import { CategoryCarousel } from "../headless/CategoryCarousel.js";
import type { CarouselEntry } from "../headless/CategoryCarousel.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  PHONE_CONTROL_HEIGHT,
  SkinDialog,
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

/**
 * The tile's own ANATOMY, orthogonal to {@link TileDensity} (which packs the
 * SCROLLER's columns) and to {@link TileLayout} (scroll vs wrap).
 *
 * `"regular"` (default) is the reference root tile — label top-left, art
 * bottom-right, unchanged. `"compact"` is the reference's SECOND-level tile
 * (owner's verdict, 2026-09-04): a person landing inside a category sees a
 * denser row — name on the left, a small picture on the right, about HALF the
 * root tile's height for the same width. A root page (the home) stays
 * `"regular"`; every tile page below it is where `"compact"` belongs.
 */
export type TileSize = "regular" | "compact";

/**
 * `"compact"` size's own geometry — a THIRD anatomy, not a smaller `cozy` or
 * a re-skinned `density: "compact"` (that one centres the art over the label
 * for the phone SCROLLER; this one is a horizontal row, because the two solve
 * different problems at different depths of the catalogue).
 *
 * The aspect ratio is derived, not guessed: {@link TILE_ASPECT_RATIO} is
 * `4 / 3` (height = 0.75 × width), so HALF that height at the same width is
 * `1.5 / 4` → `8 / 3` the other way up.
 */
const COMPACT_SIZE_ASPECT_RATIO = "8 / 3";
/** Denser grid than the regular 240px default — the owner's number. */
const COMPACT_SIZE_MIN_TILE_WIDTH = 220;
/** Smaller type at this density — the label is one clamped line shorter too
 * (2, not 3), because a horizontal row has no third line to spend. */
const COMPACT_SIZE_LABEL_FONT_SIZE = 13;
/** A small picture, never a corner ornament at this size — a fixed fraction
 * of the row, capped so a wide row does not inflate it into a second tile. */
const COMPACT_SIZE_ART_WIDTH = "32%";
const COMPACT_SIZE_ART_MAX_PX = 56;
/** Tighter gap between tiles at this density, and between the label and the
 * picture inside one row. */
const COMPACT_SIZE_GAP = spacing[1];
const DEFAULT_GAP = spacing[2];

/** Tile proportions — wider than tall, so a two-line label and the art corner
 * both fit without the row eating the fold. */
const TILE_ASPECT_RATIO = "4 / 3";

/**
 * The art corner's own aspect ratio — the same ratio {@link TileImage} draws
 * its `<img>` at. Giving the WRAPPER this ratio too (not just the image) is
 * what reserves the corner's height on the first frame: a definite width (a
 * percentage of the tile, itself sized by {@link TILE_ASPECT_RATIO} from a
 * definite grid column) times a definite ratio is a definite height, with no
 * dependency on an asset that has not decoded yet. The box is the SAME shape
 * whether it ends up holding a picture or {@link TileMonogram} — the tile's
 * own height must not depend on which one a row happens to have.
 */
const ART_ASPECT_RATIO = "3 / 2";

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

/**
 * THE BOX THE TILES ARRIVE INTO — the row's own geometry, filled with
 * skeletons, and the one place it is written.
 *
 * Shared between the carousel arm's `loading` slot and
 * {@link CategoryTileGridProps.reserve}, because a reserved box that is not
 * the box the tiles land in is a smaller shift rather than no shift: the
 * skeletons carry {@link TILE_ASPECT_RATIO} inside the same
 * {@link listStyle} grid, so the reservation is the same height whichever
 * side of the seam asked for it.
 */
function ReservedTiles(props: {
  readonly layout: TileLayout;
  readonly density: TileDensity;
  readonly minTileWidth: number;
  readonly size: TileSize;
}): ReactElement {
  return (
    <div
      style={listStyle(props.layout, props.density, props.minTileWidth, props.size)}
    >
      {SKELETON_TILES.map((slot) => (
        <Skeleton.Button
          key={slot}
          active
          block
          style={{ aspectRatio: TILE_ASPECT_RATIO, height: "auto" }}
        />
      ))}
    </div>
  );
}

/** The scroller's own geometry, `gap` threaded through so `size: "compact"`
 * (see {@link COMPACT_SIZE_GAP}) can tighten it without a second copy of the
 * grid rules. */
function scrollerStyle(density: TileDensity, gap: number): CSSProperties {
  const columns =
    density === "compact"
      ? `min(calc(100% / ${COMPACT_VISIBLE_COLUMNS} - ${gap}px), ${COMPACT_MAX_COLUMN_PX}px)`
      : // `100%` is the SCROLL PORT's content box, so the tile is a fraction
        // of the box it was mounted in — see this file's header.
        `calc(100% / ${VISIBLE_COLUMNS} - ${gap}px)`;
  return {
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: `repeat(${TILE_ROWS}, auto)`,
    gridAutoColumns: columns,
    gap,
    overflowX: "auto",
    overscrollBehaviorX: "contain",
    scrollSnapType: "x proximity",
    // The scroll port is the affordance; a scrollbar over a 2-row tile grid
    // on a phone is chrome that covers the art.
    scrollbarWidth: "none",
  };
}

/**
 * The two ways the tiles fill their container.
 *
 * `"scroll"` (default) is the reference phone row: two rows deep, sideways,
 * with the peeking column that says there is more. `"wrap"` is the same tiles
 * with no scroll port at all — as many per line as the width allows, wrapping
 * onto as many lines as it takes, so EVERY category is on screen at once.
 *
 * A landing that wants the whole catalogue visible (a desktop home page, a
 * category page's subcategories) cannot get there from the scroller: a wrapped
 * grid is a different geometry, not a wider one, and a host that needed it had
 * to draw its own tiles — which is the same tile anatomy re-implemented, and
 * the copy that drifts.
 */
export type TileLayout = "scroll" | "wrap";

/**
 * The narrowest a wrapped tile may be before the grid drops a column
 * (`repeat(auto-fill, minmax(...))`). 240px is the reference desktop tile.
 */
const DEFAULT_MIN_TILE_WIDTH = 240;

/**
 * The wrapping arm.
 *
 * `min(<width>, 100%)` rather than the bare width: `minmax` with a fixed
 * minimum is the classic auto-fill overflow — inside a container narrower
 * than one tile the track keeps its minimum and the page scrolls sideways,
 * which is precisely the thing this layout exists not to do.
 */
function wrapStyle(minTileWidth: number, gap: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fill, minmax(min(${String(minTileWidth)}px, 100%), 1fr))`,
    gap,
  };
}

/** The container the tiles sit in — one of the two geometries. */
function listStyle(
  layout: TileLayout,
  density: TileDensity,
  minTileWidth: number,
  size: TileSize
): CSSProperties {
  const gap = size === "compact" ? COMPACT_SIZE_GAP : DEFAULT_GAP;
  return layout === "wrap" ? wrapStyle(minTileWidth, gap) : scrollerStyle(density, gap);
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

/**
 * The compact tile is a different ANATOMY, not just a smaller cozy tile: at
 * ~70px the reference label-top-left/art-bottom-right corners collide, and a
 * hyphenating root name clipped to its first syllable ("Nedvi-") reads as a
 * broken screen. The dense-grid convention every classified app uses at this
 * size is the icon centred on top with the label centred under it — the
 * label gets the tile's full width, which is what lets a long root name
 * hyphenate into two honest lines instead of clipping into one.
 */
const tileCompact: CSSProperties = {
  ...tileBase,
  aspectRatio: "1 / 1",
  padding: spacing[2],
  justifyContent: "center",
  alignItems: "center",
  gap: spacing[1],
};

/**
 * `size: "compact"`'s own tile — a HORIZONTAL row (name left, small picture
 * right), not the `density: "compact"` icon-over-label square above. `size`
 * takes precedence: the two never both apply to one tile.
 */
const tileSizeCompact: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing[2],
  aspectRatio: COMPACT_SIZE_ASPECT_RATIO,
  padding: spacing[2],
  borderRadius: radii.lg,
  background: cssVar("surface-sunken"),
  color: cssVar("text"),
  scrollSnapAlign: "start",
  overflow: "hidden",
};

function tileStyle(density: TileDensity, size: TileSize): CSSProperties {
  if (size === "compact") return tileSizeCompact;
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
  // NOT `hyphens: auto`. The argument for it was that a word wider than the
  // tile should break like a book word rather than clip — and on a 70px
  // phone tile the browser took that permission everywhere: the deployed
  // home screen hyphenated its four longest root captions mid-word, set a
  // nine-letter one in three lines and a four-word one in six (walker D90,
  // four passes). A hyphen inside a NAVIGATION LABEL is not
  // typesetting, it is a word the reader has to reassemble before they can
  // decide whether to tap it, and the clamp below already answers the case
  // hyphenation was defending against.
  //
  // `manual` still honours a soft hyphen a catalogue author writes into the
  // name on purpose; it just stops the browser inventing its own.
  hyphens: "manual",
  // `anywhere` STAYS, and it is what makes `hyphens: manual` an improvement
  // rather than a trade. Without it a caption too wide for the column stops
  // breaking at all and the clamp ellipsizes it on its first line — measured
  // on the 128px compact tile, which turned the longest root name into nine
  // letters and a dot. `overflow-wrap` breaks the same word in the same place
  // hyphenation would have, and prints no character that was never in the
  // name: the whole caption is readable, and nothing in it can be mistaken
  // for punctuation the catalogue author wrote.
  overflowWrap: "anywhere",
};

const labelCompact: CSSProperties = {
  ...labelStyle,
  fontSize: COMPACT_LABEL_FONT_SIZE,
  lineHeight: 1.2,
  textAlign: "center",
  // Two centred lines under the icon; the third line belongs to the cozy
  // anatomy, where the label owns the top of the tile.
  WebkitLineClamp: 2,
};

/** Compact art: centred over the label, never a corner ornament. A fixed
 * width plus {@link ART_ASPECT_RATIO} — see that constant — instead of a
 * shrink-to-fit cap, so the box has its final size before anything is drawn
 * inside it. */
const artCompact: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "50%",
  aspectRatio: ART_ASPECT_RATIO,
};

const artStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  alignSelf: "flex-end",
  width: "60%",
  aspectRatio: ART_ASPECT_RATIO,
};

/** `size: "compact"`'s label: smaller type, one clamped line fewer than the
 * regular tile — a horizontal row has no third line to spend. */
const labelSizeCompact: CSSProperties = {
  ...labelStyle,
  fontSize: COMPACT_SIZE_LABEL_FONT_SIZE,
  lineHeight: 1.25,
  textAlign: "start",
  WebkitLineClamp: 2,
};

/** `size: "compact"`'s small picture — a fixed fraction of the row, capped so
 * a wide row does not inflate it into a second tile. */
const artSizeCompact: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  width: COMPACT_SIZE_ART_WIDTH,
  maxWidth: COMPACT_SIZE_ART_MAX_PX,
  aspectRatio: ART_ASPECT_RATIO,
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

/**
 * The seeded catalogue's art: `catalog_icon` when it already holds an address.
 *
 * Three arms, in this order, and the order is the contract: the host's
 * `renderIcon` first (a storefront that hardcodes its own root glyphs keeps
 * them), then an address — the host's `resolveIconSrc`, else the row's own
 * field — and then the monogram. So the picture appears on a deployment whose
 * catalogue has been seeded and nowhere else, and no arm was taken away from
 * anybody: each one may DECLINE and hand the row to the next.
 *
 * 3:2 and `contain`: the generated art is 3:2 on a soft ground, and `contain`
 * is what keeps a differently-proportioned upload whole instead of cropping
 * its subject. The alt text is the category's own name — the tile's label is
 * beside it, so the two agree by construction.
 *
 * `eager` decides `loading` and `fetchPriority` — see
 * {@link CategoryTileGridProps.eagerCount}. Lazy is still the default for
 * every row past that count, because a mega-menu or a long landing draws
 * dozens of these below the fold.
 */
function TileImage(props: {
  readonly src: string;
  readonly label: string;
  readonly eager: boolean;
}): ReactElement {
  return (
    <img
      src={props.src}
      alt={props.label}
      loading={props.eager ? "eager" : "lazy"}
      {...(props.eager ? { fetchPriority: "high" as const } : {})}
      decoding="async"
      data-stapel-tile-art="image"
      style={{
        width: "100%",
        aspectRatio: ART_ASPECT_RATIO,
        objectFit: "contain",
      }}
    />
  );
}

/**
 * Turn a category's opaque icon reference into an ADDRESS — the seam for a
 * host whose CDN needs a lookup rather than a prefix.
 *
 * `renderIcon` already lets a host draw whatever it likes, but it costs the
 * host the tile's own `<img>` (its lazy loading, its aspect ratio, its alt
 * text) for the one thing it usually wants: the URL. A resolver hands back a
 * string and keeps the library's picture.
 *
 * It takes the CATEGORY, not the reference, because a store of opaque refs
 * (`product/<sha256>`) is keyed by the row, and the alternative — projecting
 * every row into a new `entries` array just to rewrite one field — is a copy
 * of the catalogue per render.
 *
 * `undefined` is DECLINING this row, not an error: the next arm answers.
 * Whatever comes back still goes through {@link categoryIconSrc}, so a
 * resolver that returns an opaque string or a `data:` URI draws the monogram
 * rather than a broken image.
 */
export type CategoryIconResolver = (category: Category) => string | undefined;

/**
 * The art of one tile: the host's `renderIcon`, then an address, then the
 * monogram — and EVERY arm may decline.
 *
 * Declining is the whole correction here. `renderIcon` used to be returned
 * unconditionally whenever the row carried a reference, so a host that draws
 * its own glyph for five roots and `null` for the rest turned the other two
 * arms off for the entire catalogue: the seeded `catalog_icon` never drew, and
 * neither did the monogram — every unglyphed tile had an empty art corner,
 * which reads as a tile that failed to load. `null` (and `undefined`) from a
 * host renderer means "not this row", and the next arm answers.
 */
function tileArt(
  reference: string | null,
  label: string,
  entry: CarouselEntry,
  eager: boolean,
  renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode,
  resolveIconSrc?: CategoryIconResolver
): ReactNode {
  if (reference !== null && renderIcon !== undefined) {
    const drawn = renderIcon(reference, entry);
    if (drawn !== null && drawn !== undefined) return drawn;
  }
  // The resolver first, then the row's own field: a host that can address the
  // opaque reference knows more about its CDN than the row does, and a
  // resolver that declines leaves the seeded URL exactly where it was.
  const src = categoryIconSrc(resolveIconSrc?.(entry.category) ?? reference);
  if (src !== null) return <TileImage src={src} label={label} eager={eager} />;
  return <TileMonogram label={label} />;
}

/** The one character a monogram shows: the label's first letter, uppercased
 * in the label's OWN locale rules — `toLocaleUpperCase` and not
 * `toUpperCase`, so a Turkish `i` becomes `İ` rather than `I`. */
function firstLetter(label: string): string {
  const [first] = [...label.trim()];
  return first === undefined ? "" : first.toLocaleUpperCase();
}

/**
 * The label + art pairing for ONE tile, in whichever of the three anatomies
 * applies — shared between {@link Tile} and {@link MoreTile}, which differ
 * only in what wraps this (a link vs a button).
 *
 * `size: "compact"` takes precedence over `density`: the two never both
 * apply to one tile — see {@link tileStyle}.
 */
function tileBody(props: {
  readonly label: string;
  readonly art: ReactNode;
  readonly size: TileSize;
  readonly density: TileDensity;
  readonly testId?: string;
}): ReactElement {
  const labelProps =
    props.testId !== undefined ? { "data-testid": props.testId } : {};
  if (props.size === "compact") {
    return (
      <>
        <span style={labelSizeCompact} {...labelProps}>
          {props.label}
        </span>
        <span style={artSizeCompact}>{props.art}</span>
      </>
    );
  }
  if (props.density === "compact") {
    return (
      <>
        <span style={artCompact}>{props.art}</span>
        <span style={labelCompact} {...labelProps}>
          {props.label}
        </span>
      </>
    );
  }
  return (
    <>
      <span style={labelStyle} {...labelProps}>
        {props.label}
      </span>
      <span style={artStyle}>{props.art}</span>
    </>
  );
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
  readonly size: TileSize;
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
      style={tileStyle(props.density, props.size)}
    >
      {tileBody(props)}
    </CategoryLink>
  );
}

/**
 * The overflow tile/button ("All categories") — drawn in place of the rows
 * past {@link CategoryTileGridProps.maxVisible} when
 * {@link CategoryTileGridProps.overflow} is `"modal"`. Same anatomy as an
 * ordinary tile (art corner, label) so it sits in the grid without a visual
 * seam; a `<button>`, not a link, because it opens the dialog rather than
 * navigating.
 */
function MoreTile(props: {
  readonly label: string;
  readonly extraCount: number;
  readonly density: TileDensity;
  readonly size: TileSize;
  readonly testId: string;
  readonly onClick: () => void;
  /** `stapel/clickable-needs-event` opt-out, checked on THIS element — see
   * the call site in `TileRow`, which carries the same two attributes. */
  readonly "data-analytics"?: "none";
  readonly "data-analytics-reason"?: string;
}): ReactElement {
  return (
    <button
      type="button"
      style={{
        ...tileStyle(props.density, props.size),
        border: "none",
        cursor: "pointer",
        font: "inherit",
        textAlign: "start",
      }}
      data-testid={props.testId}
      data-analytics="none"
      data-analytics-reason="opens the local overflow dialog; nothing leaves the browser"
      onClick={props.onClick}
    >
      {tileBody({
        label: props.label,
        art: <MoreGlyph count={props.extraCount} />,
        size: props.size,
        density: props.density,
      })}
    </button>
  );
}

/** The overflow tile's own art: `+N`, faint like {@link TileMonogram} — the
 * accessible name comes from the button's own label, this is decorative. */
function MoreGlyph(props: { readonly count: number }): ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        fontSize: "1.5em",
        lineHeight: 1,
        fontWeight: fontWeight.bold,
        color: cssVar("text"),
        opacity: 0.5,
      }}
    >
      +{props.count}
    </span>
  );
}

export interface CategoryTileGridProps extends ThemeModeProp, LinkComponentProp {
  /** Path prefix for a tile's link, and the "All" tile's own href. Default
   * `/c` — the same convention `<CategoryCarousel>` and the spec's `/c/:slug`
   * already use. */
  readonly basePath?: string;
  /**
   * Turn an opaque icon reference into something renderable — the same
   * contract `<CategoryCarouselStrip>` takes.
   *
   * Returning `null` DECLINES the row and the remaining arms answer it: the
   * row's own address if it carries one, otherwise {@link TileMonogram}. So a
   * host that only has glyphs for its five roots hands back `null` for
   * everything else and the rest of the catalogue keeps its art.
   */
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
  /**
   * Address a row's opaque icon reference without projecting the rows — see
   * {@link CategoryIconResolver}. Consulted after `renderIcon` and before the
   * row's own `catalog_icon`; `undefined` declines.
   */
  readonly resolveIconSrc?: CategoryIconResolver;
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
   * one load two owners — {@link CategoryTileGridProps.reserve} is how the
   * host lends this one back the ONE thing it cannot own, which is the row's
   * height before the rows exist.
   */
  readonly entries?: readonly CarouselEntry[];
  /**
   * HOLD THE ROW'S BOX WHILE THE HOST'S OWN FETCH IS IN FLIGHT.
   *
   * The `entries` override skips this component's loading arm on purpose (the
   * host owns that read), and the consequence was a hole in the layout: a
   * category page that has not resolved its children yet renders no tile row
   * at all, and the row then APPEARS a beat later and pushes everything under
   * it down the page. The pair already draws exactly the right box — the same
   * grid, the same aspect ratio, the same skeletons — in its own loading arm;
   * without this prop the only way to get it was for the host to re-implement
   * it, and the measured storefront instead reserved a hand-guessed height in
   * its own stylesheet.
   *
   *  - `false` (default) — unchanged: no rows, no box.
   *  - `true` — reserve while `entries` is `undefined`, i.e. for exactly as
   *    long as the host has handed nothing over. An empty array is a real
   *    answer ("this category has no children") and ends the reservation.
   *  - `"pending"` — the host STATES that its read is in flight, and the box
   *    is held whatever `entries` currently says. For a host that keeps the
   *    previous rows in hand across a refetch and would rather hold the box
   *    than show a stale row.
   *
   * The reservation never asks the server anything: like the override arm,
   * `<CategoryCarousel>` stays unmounted, so a host-driven row costs no
   * `GET /categories/carousel/` in either state. Past the depth cap it is
   * nothing at all — there are no tiles to reserve room for.
   */
  readonly reserve?: boolean | "pending";
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
  /**
   * How the tiles fill the container — see {@link TileLayout}. Default
   * `"scroll"`, the reference two-row scroller, so no existing host changes
   * shape.
   */
  readonly layout?: TileLayout;
  /**
   * The narrowest a tile may be in `layout="wrap"` before the grid drops a
   * column. Default 240px. Ignored by `"scroll"`, whose column width comes
   * from {@link TileDensity} and the container.
   */
  readonly minTileWidth?: number;
  /**
   * How many of the leading tiles (by `entries` order, the "All" tile not
   * counted — it never carries an image) load their picture EAGERLY, with
   * `fetchPriority="high"`, instead of `loading="lazy"`. Default 8.
   *
   * A grid whose whole first row sits above the fold and still marks every
   * image `lazy` gives the browser no reason to fetch them before first
   * paint, so the row's real height (and whatever sits below it) arrives a
   * beat late — a walker measured a home page shoving its feed 224px down
   * this way. Past `eagerCount` a tile stays `lazy`: a mega-menu or a long
   * `layout="wrap"` landing still must not fetch dozens of images nobody has
   * scrolled to.
   */
  readonly eagerCount?: number;
  /**
   * The tile's own anatomy — see {@link TileSize}. Default `"regular"`, the
   * reference root tile, so no existing host changes shape. A landing below
   * the home page is where `"compact"` belongs.
   */
  readonly size?: TileSize;
  /**
   * Cap the grid at this many rows before offering the rest through
   * {@link CategoryTileGridProps.overflow}. Ignored unless `overflow` is
   * `"modal"` — see there. The "All" tile is not counted against the cap.
   */
  readonly maxVisible?: number;
  /**
   * What happens past {@link CategoryTileGridProps.maxVisible}. Default
   * `"none"` — no cap is enforced and every row draws, so `maxVisible` alone
   * changes nothing.
   *
   * `"modal"` draws exactly `maxVisible` rows plus one "All categories" tile
   * that opens a dialog (`SkinDialog`) listing EVERY child — compact rows
   * with pictures, a search box once there are more than
   * {@link ALL_CATEGORIES_SEARCH_THRESHOLD}. The reference's own second-level
   * page (owner's verdict, 2026-09-04): a compact grid capped at 10, plus the
   * button.
   */
  readonly overflow?: TileOverflow;
}

/** {@link CategoryTileGridProps.eagerCount}'s default — the reference
 * desktop grid's first row. */
const DEFAULT_EAGER_COUNT = 8;

/** {@link CategoryTileGridProps.overflow}'s two answers. */
export type TileOverflow = "none" | "modal";

/** Past this many children, the overflow dialog grows a search box — a list
 * short enough to scan needs no filter, and a search box over three rows is
 * chrome nobody asked for. */
const ALL_CATEGORIES_SEARCH_THRESHOLD = 20;

/**
 * "All categories" — every child of this rung, searchable once there are
 * enough of them, in a `SkinDialog` (a bottom sheet on a phone, a centred
 * modal on tablet/desktop — the primitive's own responsive rule, so this
 * component makes no surface choice of its own). Compact rows, each a real
 * link: a keyboard tabs through them and Enter/click navigates like any other
 * tile, and Esc / the mask / the dialog's own dismiss control close it — all
 * `SkinDialog`'s doing.
 */
function AllCategoriesDialog(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly entries: readonly CarouselEntry[];
  readonly linkComponent?: LinkComponent;
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
  readonly resolveIconSrc?: CategoryIconResolver;
}): ReactElement {
  const t = useT();
  const [query, setQuery] = useState("");
  const linkProps =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};
  const rows = useMemo(
    () =>
      props.entries.map((entry) => ({
        entry,
        label: renderCategoryLabel(entry.label, t),
      })),
    [props.entries, t]
  );
  const searchable = props.entries.length > ALL_CATEGORIES_SEARCH_THRESHOLD;
  const filtered =
    query === ""
      ? rows
      : rows.filter(({ label }) =>
          label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
        );

  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={t(CATEGORIES_I18N_KEYS.tilesShowAll)}
      dismissLabel={t(STAPEL_UI_KEYS.dismiss)}
      data-testid="categories-tile-grid-dialog"
    >
      <Flex vertical gap={spacing[2]}>
        {searchable ? (
          <Input
            allowClear
            value={query}
            placeholder={t(CATEGORIES_I18N_KEYS.tilesAllSearch)}
            aria-label={t(CATEGORIES_I18N_KEYS.tilesAllSearch)}
            data-testid="categories-tile-grid-dialog-search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        ) : null}
        {filtered.length === 0 ? (
          <EmptyState
            testId="categories-tile-grid-dialog-empty"
            compact
            title={t(CATEGORIES_I18N_KEYS.tilesAllNoMatches)}
          />
        ) : (
          <List
            data-testid="categories-tile-grid-dialog-list"
            size="small"
            dataSource={filtered}
            renderItem={({ entry, label }) => (
              <List.Item
                key={entry.category.id}
                data-testid={`categories-tile-grid-dialog-option-${String(entry.category.id)}`}
              >
                <CategoryLink
                  {...linkProps}
                  slug={entry.category.slug}
                  categoryId={entry.category.id}
                  href={entry.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing[2],
                    width: "100%",
                    minHeight: PHONE_CONTROL_HEIGHT,
                    color: cssVar("text"),
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      width: spacing[7],
                      height: spacing[7],
                      flex: "0 0 auto",
                    }}
                  >
                    {tileArt(
                      entry.icon,
                      label,
                      entry,
                      false,
                      props.renderIcon,
                      props.resolveIconSrc
                    )}
                  </span>
                </CategoryLink>
              </List.Item>
            )}
          />
        )}
      </Flex>
    </SkinDialog>
  );
}

/** The scroll port itself: the "All" tile, then one tile per row, then —
 * past `maxVisible` under `overflow: "modal"` — the "All categories" tile and
 * its dialog. */
function TileRow(props: {
  readonly entries: readonly CarouselEntry[];
  readonly basePath: string;
  readonly allTile?: boolean;
  readonly linkComponent?: LinkComponent;
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
  readonly resolveIconSrc?: CategoryIconResolver;
  readonly density: TileDensity;
  readonly size: TileSize;
  readonly layout: TileLayout;
  readonly minTileWidth: number;
  readonly eagerCount: number;
  readonly maxVisible?: number;
  readonly overflow: TileOverflow;
}): ReactElement {
  const t = useT();
  const [dialogOpen, setDialogOpen] = useState(false);
  const linkProps =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};
  const capped =
    props.overflow === "modal" &&
    props.maxVisible !== undefined &&
    props.entries.length > props.maxVisible;
  const visible = capped ? props.entries.slice(0, props.maxVisible) : props.entries;
  const hiddenCount = capped ? props.entries.length - visible.length : 0;

  return (
    <>
      <div
        style={listStyle(props.layout, props.density, props.minTileWidth, props.size)}
        data-stapel-tile-layout={props.layout}
        data-testid="categories-tile-grid-list"
      >
        {props.allTile !== false && (() => {
          const allLabel = t(CATEGORIES_I18N_KEYS.tilesAll);
          return (
            <Tile
              {...linkProps}
              density={props.density}
              size={props.size}
              href={props.basePath}
              label={allLabel}
              art={<TileMonogram label={allLabel} />}
              testId="categories-tile-grid-all"
            />
          );
        })()}
        {visible.map((entry, index) => {
          const label = renderCategoryLabel(entry.label, t);
          return (
            <Tile
              key={entry.category.id}
              {...linkProps}
              density={props.density}
              size={props.size}
              href={entry.href}
              slug={entry.category.slug}
              categoryId={entry.category.id}
              label={label}
              art={tileArt(
                entry.icon,
                label,
                entry,
                index < props.eagerCount,
                props.renderIcon,
                props.resolveIconSrc
              )}
            />
          );
        })}
        {capped ? (
          <MoreTile
            label={t(CATEGORIES_I18N_KEYS.tilesShowAll)}
            extraCount={hiddenCount}
            density={props.density}
            size={props.size}
            testId="categories-tile-grid-more"
            data-analytics="none"
            data-analytics-reason="opens the local overflow dialog; nothing leaves the browser"
            onClick={() => {
              setDialogOpen(true);
            }}
          />
        ) : null}
      </div>
      {capped ? (
        <AllCategoriesDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
          }}
          entries={props.entries}
          {...linkProps}
          {...(props.renderIcon !== undefined ? { renderIcon: props.renderIcon } : {})}
          {...(props.resolveIconSrc !== undefined
            ? { resolveIconSrc: props.resolveIconSrc }
            : {})}
        />
      ) : null}
    </>
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
  const size: TileSize = props.size ?? "regular";
  const overflow: TileOverflow = props.overflow ?? "none";
  const layout: TileLayout = props.layout ?? "scroll";
  const minTileWidth =
    props.minTileWidth ??
    (size === "compact" ? COMPACT_SIZE_MIN_TILE_WIDTH : DEFAULT_MIN_TILE_WIDTH);
  const eagerCount = props.eagerCount ?? DEFAULT_EAGER_COUNT;
  const rowProps = {
    basePath,
    density,
    size,
    layout,
    minTileWidth,
    eagerCount,
    overflow,
    ...(props.maxVisible !== undefined ? { maxVisible: props.maxVisible } : {}),
    ...(props.allTile !== undefined ? { allTile: props.allTile } : {}),
    ...(props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {}),
    ...(props.renderIcon !== undefined ? { renderIcon: props.renderIcon } : {}),
    ...(props.resolveIconSrc !== undefined
      ? { resolveIconSrc: props.resolveIconSrc }
      : {}),
  };
  const override = props.entries;
  // The host's read is in flight — see `reserve`. `"pending"` is the host
  // saying so; `true` infers it from the one fact this component has, which
  // is that no rows have been handed over yet.
  const reserving =
    props.reserve === "pending" ||
    (props.reserve === true && override === undefined);

  if (!offersTiles) return null;

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <nav
        aria-label={t(CATEGORIES_I18N_KEYS.carouselTitle)}
        data-testid="categories-tile-grid"
      >
        {reserving ? (
          // The substrate's own loading arm, by hand: this load belongs to the
          // host, so `LoadList` has no state to route — but the box, the busy
          // role and the `data-stapel-load-state` stamp are the fleet's, and a
          // reservation that announced itself differently from every other
          // pending region would be a second dialect of "wait".
          <div
            role="status"
            aria-busy="true"
            aria-label={t(STAPEL_UI_KEYS.loading)}
            data-stapel-load-state="loading"
            data-testid="categories-tile-grid-reserved"
          >
            <ReservedTiles
              layout={layout}
              density={density}
              minTileWidth={minTileWidth}
              size={size}
            />
          </div>
        ) : override !== undefined ? (
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
                  <ReservedTiles
                    layout={layout}
                    density={density}
                    minTileWidth={minTileWidth}
                    size={size}
                  />
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
