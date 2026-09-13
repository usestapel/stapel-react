/**
 * "FIND MORE" — the two strips a listing page ends with, and why they are two.
 *
 * The reference classified draws them as separate sections with separate
 * promises (§16 comparison 4): "more options like this one", which is the
 * category and the listing's main axes, and "other listings from this seller",
 * which is one person's shelf. A buyer reading the first is still shopping;
 * a buyer reading the second has decided who they are buying from. Collapsing
 * them into one "related" rail answers neither question.
 *
 * ── WHERE THE ROWS COME FROM, and why not from here ───────────────────────
 *
 * Both lists are SEARCH results, and this pair does not read search: the query
 * is `category=<slug>` plus the main axis filters for the first, and
 * `owner=<uuid>` for the second, and building either means knowing a search
 * module's parameter names and a category's slug — neither of which a listings
 * pair has (the detail wire carries `category_id`, a number, and no slug).
 *
 * So the seam is two-sided and the host picks its side:
 *
 *  - `similar` / `fromSeller` — the ROWS, already fetched. The pane draws
 *    this component with them, which is the whole of what a host needs on a
 *    storefront that already has a search client;
 *  - `renderSimilar` / `renderFromSeller` — the SLOT, handed everything the
 *    pane knows to build a query with ({@link ListingRelatedContext}). For a
 *    host whose "more like this" is not a strip of cards at all — the
 *    reference's own first mechanism is a set of catalogue LINKS, not
 *    listings.
 *
 * Neither is drawn empty. A heading over nothing is worse than no heading: it
 * reads as a section that failed to load.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import { Flex, Typography, theme as antdTheme } from "antd";
import { useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { TITLE_CLAMP_CLASS } from "./titleClamp.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import type {
  ListingCard as ListingCardData,
  ListingFeatureView,
} from "../api/types.js";
import { ListingFeedCard } from "./ListingFeedCard.js";

/** The class the horizontal strip carries. */
export const RELATED_STRIP_CLASS = "stapel-listings-related";
/** The class the box that holds the strip AND its edge controls carries. */
export const RELATED_FRAME_CLASS = "stapel-listings-related-frame";
/** The class one edge control carries. */
export const RELATED_ARROW_CLASS = "stapel-listings-related-arrow";
/** The `href` the hoisted strip stylesheet is deduplicated by. */
export const RELATED_STYLE_HREF = "stapel-listings-related";

/**
 * ONE CARD'S WIDTH, and it is a fixed length.
 *
 * It was `min(46%, 220px)`. A percentage of the container makes the same card
 * a different size on every page it appears on, and the photo's height — one
 * aspect, correctly — follows it. `min()` takes the SMALLER, so the share wins
 * only on a rail narrower than about 478px: measured in headless Chromium on
 * the live page while this was being written, the card is 175.72px wide with
 * a 131.78px photo at 390 and 220 / 165 at 1440. One card, two sizes, which
 * is the range of widths and the differing photo heights two reviewers
 * reported across the four viewports they walked.
 *
 * 220 is the number the `min()` already reached at every width that had room
 * for it, so no desktop rail changes. On a 390px phone the card is now wider
 * than the 175.72 it was: 220 of a 382px rail still leaves 162px of the next
 * card showing, which is the peek the old `46%` was chosen for, and a card
 * that is the same size here as on the desktop is the point of a fixed one.
 */
export const RELATED_CARD_WIDTH = 220;

/** The gap between two cards. Exported because it is the other half of one
 * scroll step: an arrow that moves by a card alone lands the rail between two
 * of them. */
export const RELATED_CARD_GAP: number = spacing[3];

/**
 * How far the rail's own edge controls are inset, and how big they are. Not
 * spacing steps: a hit target is a piece of geometry, and 36 is this skin's
 * own card-surface tier (`actionRow.ts`).
 */
const ARROW_SIDE = 36;

/**
 * What the pane knows about this listing, for a host building the queries.
 *
 * `categoryId` is the wire's own value and it is a STRING there — the detail
 * serializer types it `string | null`, and this contract does not quietly
 * reinterpret it.
 */
export interface ListingRelatedContext {
  readonly listingId: number;
  /** The listing's category, as the wire carries it. */
  readonly categoryId: string | undefined;
  /** The seller — the `owner=` filter's value. */
  readonly ownerKey: string | undefined;
  /**
   * The listing's MAIN AXES, as the category itself projected them: the
   * `show_at_title` subset, which is the same set a card's title line prints
   * and the nearest thing to "what makes two of these alike".
   */
  readonly axes: readonly ListingFeatureView[];
}

/**
 * The strip's rules an inline style cannot reach.
 *
 * Three of them are the staircase the reviewers measured:
 *
 *  - the CARD WIDTH is one fixed length ({@link RELATED_CARD_WIDTH}), so a
 *    card is the same card on a phone and on a desktop and its photo — which
 *    has had one aspect all along — is therefore the same height;
 *  - the TITLE reserves two lines (`min-block-size: 2lh`, two of the title's
 *    own line-height) whether the seller wrote one or two. Without it a card
 *    whose title fits on one line pulls its price 24px up, which is exactly
 *    the step measured across one live rail: six prices at 1733px and two at
 *    1709. `lh` is the only unit that means "this element's line box" and
 *    needs no copy of the type scale here; a browser that does not know it
 *    reserves nothing and draws what it draws today.
 *  - `scroll-behavior: smooth` so the arrow's press is a movement a person can
 *    follow, turned off where the reader has asked for less motion.
 *
 * A sheet rather than inline styles because two of the three reach a CHILD
 * (the card's own box, the title inside it), which an inline style cannot.
 */
export function relatedStripCss(): string {
  return (
    `.${RELATED_FRAME_CLASS}{position:relative;min-inline-size:0}` +
    `.${RELATED_STRIP_CLASS}{display:flex;overflow-x:auto;` +
      `gap:${String(RELATED_CARD_GAP)}px;scroll-snap-type:x proximity;` +
      `scroll-behavior:smooth}` +
    `@media (prefers-reduced-motion: reduce){` +
      `.${RELATED_STRIP_CLASS}{scroll-behavior:auto}}` +
    `.${RELATED_STRIP_CLASS}>*{flex:0 0 ${String(RELATED_CARD_WIDTH)}px;` +
      `scroll-snap-align:start}` +
    `.${RELATED_STRIP_CLASS} .${TITLE_CLAMP_CLASS}{min-block-size:2lh}` +
    // The edge controls: over the rail, vertically centred on the PHOTO rather
    // than on the card, because the card's lower half is text and an arrow
    // standing in it covers the words it is offering to scroll past.
    `.${RELATED_ARROW_CLASS}{position:absolute;inset-block-start:0;` +
      `inline-size:${String(ARROW_SIDE)}px;block-size:${String(ARROW_SIDE)}px;` +
      `display:flex;align-items:center;justify-content:center;` +
      `border-radius:50%;border:none;cursor:pointer;z-index:1;` +
      `background:var(--listing-rail-arrow-bg);color:var(--listing-rail-arrow-fg);` +
      `box-shadow:var(--listing-rail-arrow-shadow)}` +
    `.${RELATED_ARROW_CLASS}[data-edge="back"]{inset-inline-start:0}` +
    `.${RELATED_ARROW_CLASS}[data-edge="forward"]{inset-inline-end:0}`
  );
}

/**
 * WHETHER THE RAIL HAS ANYWHERE TO GO, in each direction.
 *
 * Measured from the element and not guessed from the item count: how many
 * cards fit is a question about the container's width, which this component
 * does not know and must not restate. Read on mount, on every scroll and on
 * every resize of the rail itself.
 *
 * Both answers are `false` until something has been measured, which is the
 * honest floor: a control that scrolls nowhere is worse than no control, and
 * a rail whose content fits draws neither arrow at all.
 */
function useRailEdges(ref: RefObject<HTMLDivElement | null>): {
  readonly back: boolean;
  readonly forward: boolean;
} {
  const [edges, setEdges] = useState({ back: false, forward: false });
  useEffect(() => {
    const rail = ref.current;
    if (rail === null) return;
    const read = (): void => {
      // One CSS pixel of slack: a scroller at its end can report a fractional
      // remainder that is not a card and not a pixel anybody can see.
      const forward = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1;
      const back = rail.scrollLeft > 1;
      setEdges((was) =>
        was.back === back && was.forward === forward ? was : { back, forward }
      );
    };
    read();
    rail.addEventListener("scroll", read, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(read);
    observer?.observe(rail);
    return () => {
      rail.removeEventListener("scroll", read);
      observer?.disconnect();
    };
  }, [ref]);
  return edges;
}

/** The chevron, drawn here like every other glyph in this skin — the package
 * ships no icon set. `aria-hidden` because the button carries the words. */
function Chevron(props: { readonly back: boolean }): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={props.back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/**
 * The arrow's own colours, from the theme rather than from the sheet: a
 * hoisted stylesheet is ONE copy for the document and this skin serves both
 * themes at once, so the two colours travel as custom properties set per
 * instance. Elevated rather than flat — the control stands OVER photographs,
 * where a flat surface disappears into whichever picture is behind it.
 */
function ARROW_PAINT(token: {
  colorBgElevated: string;
  colorText: string;
  boxShadowSecondary: string;
}): CSSProperties {
  return {
    ["--listing-rail-arrow-bg" as string]: token.colorBgElevated,
    ["--listing-rail-arrow-fg" as string]: token.colorText,
    ["--listing-rail-arrow-shadow" as string]: token.boxShadowSecondary,
  };
}

export interface ListingRelatedStripProps {
  /** The section's caption. */
  readonly heading: string;
  readonly items: readonly ListingCardData[];
  /** Where "show all" goes — the search this strip is a sample of. Absent,
   * there is no link: a strip of three with nowhere to go is honest, and an
   * inert "show all" is not. */
  readonly showAllHref?: string;
  /** Where one card goes. Absent, the cards are inert — which is what a
   * host mounting this inside its own link wrapper wants. */
  readonly listingHref?: (id: number) => string;
  readonly linkComponent?: LinkComponent;
  readonly testId: string;
}

/** One "find more" section: a caption, an optional link out, and a scrolling
 * row of the pair's own feed tiles. */
export function ListingRelatedStrip(
  props: ListingRelatedStripProps
): ReactElement | null {
  const t = useT();
  const { token } = antdTheme.useToken();
  const rail = useRef<HTMLDivElement>(null);
  const edges = useRailEdges(rail);
  const { items, listingHref } = props;

  /**
   * ONE CARD FORWARD OR BACK.
   *
   * `scrollLeft` and not `scrollTo({behavior})`: the smoothness is the sheet's
   * (`scroll-behavior`), which is one declaration a reader's motion setting
   * can switch off, and setting the property is what actually moves the rail
   * in every environment including a test.
   */
  const step = (direction: 1 | -1): void => {
    const node = rail.current;
    if (node === null) return;
    const by = (RELATED_CARD_WIDTH + RELATED_CARD_GAP) * direction;
    node.scrollLeft = Math.max(0, node.scrollLeft + by);
  };

  if (items.length === 0) return null;
  const Link = props.linkComponent;
  const showAll =
    props.showAllHref === undefined ? null : Link !== undefined ? (
      <Link href={props.showAllHref} data-testid={`${props.testId}-all`}>
        {t(LISTINGS_I18N_KEYS.detailShowAll)}
      </Link>
    ) : (
      <Typography.Link href={props.showAllHref} data-testid={`${props.testId}-all`}>
        {t(LISTINGS_I18N_KEYS.detailShowAll)}
      </Typography.Link>
    );

  return (
    <Flex vertical gap={spacing[2]} data-testid={props.testId}>
      <style href={RELATED_STYLE_HREF} precedence="default">
        {relatedStripCss()}
      </style>
      <Flex align="baseline" justify="space-between" gap={spacing[3]}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {props.heading}
        </Typography.Title>
        {showAll}
      </Flex>
      <div className={RELATED_FRAME_CLASS} style={ARROW_PAINT(token)}>
        {/* THE TRAILING AFFORDANCE. Both arrows are always rendered and
            `hidden` while the rail has nowhere to go in that direction, so
            there is one element a test and a screen reader can find and no
            control that scrolls nothing. `hidden` rather than a conditional
            render: the pair of buttons is the rail's furniture, and a control
            that appears the moment a finger touches the rail is a control
            nobody saw arrive. */}
        <button
          type="button"
          data-edge="back"
          className={RELATED_ARROW_CLASS}
          data-testid={`${props.testId}-back`}
          data-analytics="none"
          data-analytics-reason="a look, not an outcome — scrolling a rail navigates nowhere"
          aria-label={t(LISTINGS_I18N_KEYS.pagePrev)}
          hidden={!edges.back}
          onClick={() => {
            step(-1);
          }}
        >
          <Chevron back />
        </button>
        <div ref={rail} className={RELATED_STRIP_CLASS}>
        {items.map((row) => {
          const href = listingHref?.(row.id);
          const open: ReactNode =
            href === undefined ? (
              <ListingFeedCard listing={row} />
            ) : (
              <ListingFeedCard
                listing={row}
                href={href}
                {...(Link !== undefined ? { linkComponent: Link } : {})}
              />
            );
          return <div key={row.id}>{open}</div>;
        })}
        </div>
        <button
          type="button"
          data-edge="forward"
          className={RELATED_ARROW_CLASS}
          data-testid={`${props.testId}-forward`}
          data-analytics="none"
          data-analytics-reason="a look, not an outcome — scrolling a rail navigates nowhere"
          aria-label={t(LISTINGS_I18N_KEYS.pageNext)}
          hidden={!edges.forward}
          onClick={() => {
            step(1);
          }}
        >
          <Chevron back={false} />
        </button>
      </div>
    </Flex>
  );
}
