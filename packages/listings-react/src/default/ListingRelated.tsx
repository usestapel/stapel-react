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
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import type {
  ListingCard as ListingCardData,
  ListingFeatureView,
} from "../api/types.js";
import { ListingFeedCard } from "./ListingFeedCard.js";

/** The class the horizontal strip carries. */
export const RELATED_STRIP_CLASS = "stapel-listings-related";
/** The `href` the hoisted strip stylesheet is deduplicated by. */
export const RELATED_STYLE_HREF = "stapel-listings-related";

/**
 * How much of the page width ONE card takes in the strip.
 *
 * A `min()` rather than a percentage: on a 390px phone the reference shows
 * roughly one and a half cards, so the next one peeks and the strip says it
 * scrolls; on a desktop a card that kept scaling with the page would be a
 * 700px tile of a 200px photograph.
 */
export const RELATED_CARD_BASIS = "min(46%, 220px)";

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

/** The strip's rule an inline style cannot reach: the cards' flex basis. */
export function relatedStripCss(): string {
  return (
    `.${RELATED_STRIP_CLASS}{display:flex;overflow-x:auto;` +
      `gap:${String(spacing[3])}px;scroll-snap-type:x proximity}` +
    `.${RELATED_STRIP_CLASS}>*{flex:0 0 ${RELATED_CARD_BASIS};scroll-snap-align:start}`
  );
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
  const { items, listingHref } = props;
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
      <div className={RELATED_STRIP_CLASS}>
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
    </Flex>
  );
}
