/**
 * `<ListingFeedCard>` — the borderless card of a phone home feed (refs §1).
 *
 * ── What "borderless" is actually doing ───────────────────────────────────
 *
 * `<ListingCard>` and `<ListingSerpCard>` are antd `Card`s: a painted surface
 * with a border, which is what makes one result read as one object next to
 * another. A two-column feed is a different picture. Twenty bordered boxes on
 * a 390px screen is twenty frames and forty vertical lines, and the photos —
 * the only thing anyone is actually looking at — end up as small pictures
 * inside chrome. So this card has no surface of its own: the photo is the
 * card, the three lines under it sit on the page's own ground, and the RHYTHM
 * of the grid is what separates one from the next. That is the ref, and it is
 * also why this is a third component rather than a `bordered={false}` on the
 * first: nothing else about the layout survives the change either.
 *
 * ── The heart is over the photo here, and only here ───────────────────────
 *
 * `<ListingCard>` argues at length that the heart belongs in a row UNDER the
 * card rather than floating on the photograph, because a blocked favourite
 * states its reason as text and there is nowhere to put a sentence on top of a
 * picture. That argument is correct and this card does not repeat its
 * conclusion, for a reason it states rather than hides: a 2-column feed tile
 * has no line to spare. A full row of "Sign in to save this" under every one
 * of twenty tiles is not twenty pieces of help — it is the feed.
 *
 * The answer this card ships with is the INTERACTION DISCLOSURE the grid card
 * and the SERP card were given in the desktop and mobile fix packs, and it is
 * this card's DEFAULT rather than an opt-in — a two-column tile is the one
 * surface in the pair with no line to put a sentence on, so a standing volume
 * here has to overprint the photograph to exist at all.
 *
 * That default is a fix, not a preference. Measured on a live home feed: this
 * was the last surface still printing "Sign in to do this" as standing copy,
 * over the picture, under every tile — and the heart under it was html-
 * `disabled`, so the one gesture that could have replaced the caption was
 * swallowed by the control. Both halves are gone: nothing stands in the tile,
 * and a tap on the heart discloses the reason and the container's sign-in
 * door (`signIn`) while a visually-hidden copy keeps the refusal in the
 * accessibility tree. A host that genuinely wants the standing sentence back
 * asks for it by name with `blockedReason="text"`.
 *
 * `GateReasonScopeContext` / `<PaneGate>` remain the answer for the STANDING
 * arm: they pool identical reasons and render each ONCE for everything inside
 * the scope, with every control's `aria-describedby` still pointing at that
 * single copy. A container drawing a feed in that arm should wrap
 * `<FeedGrid>` in a `<PaneGate>`.
 *
 * ── Two lines of title, and then it stops ─────────────────────────────────
 *
 * A feed tile is roughly 170px wide. A three-line title pushes the price below
 * the fold of the row and makes the grid ragged; a one-line ellipsis throws
 * away the half of a listing's name that distinguishes it from the one beside
 * it. Two lines, clamped, is the ref's answer and the only one that keeps the
 * price on the same y as its neighbour's.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { SignInCta } from "@stapel/core";
import { useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import type { ListingCard as ListingCardData } from "../api/types.js";
import { lifecycleCaption } from "../model/status.js";
import { isListingViewed } from "../model/engagement.js";
import { useEngagedListing } from "../headless/Engagement.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { FavoriteHeart } from "./favorite.js";
import { LISTING_CARD_ACTION_CLASS } from "./actionRow.js";
import {
  CARD_TARGET_STYLE_HREF,
  CARD_VIEWED_CLASS,
  CardTarget,
  cardTargetCss,
} from "./ListingCard.js";
import type { ListingCardOpenProps } from "./ListingCard.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { ListingPrice } from "./ListingPrice.js";
import {
  CARD_CLAMP_STYLE_HREF,
  LOCATION_CLAMP_CLASS,
  TITLE_CLAMP_CLASS,
  cardClampCss,
} from "./titleClamp.js";
import type { ThemeModeProp } from "./types.js";

/**
 * The title clamp is `titleClamp.ts`'s, not this file's.
 *
 * It lived here, and the grid card (`ListingCard`) answered the same question
 * with antd's one-line `ellipsis` — which is how the busiest surface on the
 * storefront ended up cutting job titles mid-word while the tile beside it
 * wrapped them over two lines. One answer, one module, both cards.
 *
 * These three names stay as aliases because this file's tests and a reader
 * looking for "the feed card's clamp" both expect them here.
 *
 * They are re-export bindings rather than `const` copies: under
 * `--isolatedDeclarations` the declaration emitter types each export from that
 * export alone, and `const FEED_TITLE_CLASS = TITLE_CLAMP_CLASS` gives it
 * nothing to go on. An aliased re-export carries the original's type with it.
 */
export {
  TITLE_CLAMP_CLASS as FEED_TITLE_CLASS,
  CARD_CLAMP_STYLE_HREF as FEED_CARD_STYLE_HREF,
  cardClampCss as feedCardCss,
} from "./titleClamp.js";

/** The tile. `position: relative` is what the heart and the badge overlay are
 * pinned to; `minWidth: 0` keeps a long word inside its grid track. */
const TILE: CSSProperties = { position: "relative", minWidth: 0 };

/** Pinned to the photo's leading corner: the container's own marking. */
const BADGE: CSSProperties = {
  position: "absolute",
  insetBlockStart: spacing[2],
  insetInlineStart: spacing[2],
};

/** Pinned to the photo's trailing corner. `alignItems: flex-end` so the
 * pooled-or-not reason, when there is one, stacks under the heart against the
 * same edge rather than pushing it inwards. */
const HEART: CSSProperties = {
  position: "absolute",
  insetBlockStart: spacing[2],
  insetInlineEnd: spacing[2],
  alignItems: "flex-end",
};

export interface ListingFeedCardBaseProps extends ThemeModeProp {
  readonly listing: ListingCardData;
  /**
   * Drawn over the photo's leading corner — "New", "In stock", a promotion
   * marking. A SLOT rather than a string: what earns an overlay on a feed is a
   * deployment's decision, and DSA Art. 26 marking belongs to whichever pair
   * received the fact.
   */
  readonly badgeOverlay?: ReactNode;
  /** Hide the favourite entirely — for a surface where it makes no sense.
   * NOT a way to hide it from visitors. */
  readonly showFavorite?: boolean;
  /**
   * How loudly a blocked heart states its refusal. **`"popover"` by default
   * on this card, unlike the other two** — a feed tile has no line to print a
   * sentence on, so the standing arm can only overprint the photograph. See
   * the file header for the measurement that made it the default.
   */
  readonly blockedReason?: "text" | "popover";
  /** The container's sign-in door, rendered INSIDE the disclosure. Absent:
   * the disclosure holds the reason alone. */
  readonly signIn?: SignInCta;
}

export type ListingFeedCardProps = ListingFeedCardBaseProps & ListingCardOpenProps;

export function ListingFeedCard(props: ListingFeedCardProps): ReactElement {
  const t = useT();
  // See `<ListingCard>`: the scope's overlay over the row, or the row. This
  // is the surface it matters most on — a home feed is drawn from search.
  const listing = useEngagedListing(props.listing);
  const status =
    listing.status === undefined ? undefined : lifecycleCaption(listing.status);
  const title = listing.title ?? "";
  const targetLabel =
    title.length > 0 ? title : t(LISTINGS_I18N_KEYS.cardUntitled);
  // Already seen — `false` for every response that carries no such field.
  const viewed = isListingViewed(listing);

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <style href={CARD_TARGET_STYLE_HREF} precedence="default">
        {cardTargetCss()}
      </style>
      <style href={CARD_CLAMP_STYLE_HREF} precedence="default">
        {cardClampCss()}
      </style>
      <div
        style={TILE}
        data-testid="listings-feed-card"
        data-listing-id={listing.id}
        {...(status !== undefined
          ? { "data-listing-status": status.status }
          : {})}
        {...(viewed
          ? { className: CARD_VIEWED_CLASS, "data-listing-viewed": "true" }
          : {})}
      >
        {/* One anchor over the whole tile. The photo is a still `<img>`, so
            unlike the SERP card's swipeable strip it is safe inside a link —
            and on a feed the picture IS the click. */}
        <CardTarget
          {...openProps(props)}
          listingId={listing.id}
          label={targetLabel}
          testId="listings-feed-open"
          bodyTestId="listings-feed-body"
        >
          <Flex vertical gap={spacing[1]}>
            <ListingPhoto
              imageRef={listing.images?.[0]}
              alt={title.length > 0 ? title : String(listing.id)}
              style={{ borderRadius: radii.lg }}
            />

            {/* Title before price: on a feed a person is browsing, not
                comparing — the ref's order, and the reverse of the SERP's. */}
            <Typography.Text
              className={TITLE_CLAMP_CLASS}
              data-testid="listings-feed-title"
            >
              {title}
            </Typography.Text>

            <Typography.Text strong data-testid="listings-feed-price">
              <ListingPrice
                amount={listing.price}
                {...(listing.currency !== undefined
                  ? { currency: listing.currency }
                  : {})}
              />
            </Typography.Text>

            {/* The place gets ONE line and the title two, but out of the SAME
                module — see `LOCATION_CLAMP_LINES`. It was on antd's
                `ellipsis`, which is one line by forbidding the wrap and
                therefore cuts inside a word; this is one line by allowing it
                and hiding the rest, so the ellipsis follows a whole word — and
                the whole string stays in the DOM rather than being cut in JS
                and offered back as a hover a phone cannot perform. */}
            {listing.location_label !== undefined &&
            listing.location_label.length > 0 ? (
              <Typography.Text
                type="secondary"
                className={LOCATION_CLAMP_CLASS}
                data-testid="listings-feed-location"
              >
                {listing.location_label}
              </Typography.Text>
            ) : null}
          </Flex>
        </CardTarget>

        {props.badgeOverlay !== undefined && (
          <div style={BADGE} data-testid="listings-feed-badge">
            {props.badgeOverlay}
          </div>
        )}

        {/* Outside the anchor — a button inside a link is neither valid HTML
            nor operable — and pinned rather than stacked. See the header. */}
        {props.showFavorite === false ? null : (
          <FavoriteHeart
            listingId={listing.id}
            favorited={listing.is_favorited}
            testId="listings-feed-favorite"
            className={LISTING_CARD_ACTION_CLASS}
            blockedReason={props.blockedReason ?? "popover"}
            {...(props.signIn !== undefined ? { signIn: props.signIn } : {})}
            style={HEART}
          />
        )}
      </div>
    </SkinTheme>
  );
}

/** The three-armed open union, narrowed out of this card's own props — see
 * `<ListingSerpCard>`'s copy for why it is picked rather than spread. */
function openProps(props: ListingFeedCardProps): ListingCardOpenProps {
  if (props.href !== undefined) {
    return props.linkComponent !== undefined
      ? { href: props.href, linkComponent: props.linkComponent }
      : { href: props.href };
  }
  if (props.onOpen !== undefined) return { onOpen: props.onOpen };
  return {};
}
