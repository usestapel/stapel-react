/**
 * `<ListingSerpCard>` — the one-column result card of a phone SERP.
 *
 * `<ListingCard>` is the GRID card: a photo, a price, a title and a place,
 * sized so twenty-four of them tile a desktop catalogue. This is the other
 * shape a classified needs and the one the mobile refs are drawn to (refs §3):
 * one card per row, the full width of the screen, a swipeable photo strip, and
 * a column of actions down the right-hand side. They are two components rather
 * than a `variant` prop for the reason the fleet keeps writing down — a mode
 * switch produces one component nobody can photograph either arm of, and here
 * the two arms differ in reading ORDER, not only in size.
 *
 * ── The price is first, and it is the biggest thing on the card ────────────
 *
 * On a grid card the photo carries the layout. On a one-column result the
 * photo is already full-bleed above the text, so the first LINE is where the
 * eye lands — and on a classified that line is the price. Title at regular
 * weight underneath it, the seller's own spec line muted under that. This is
 * the ref's order and it is also the order the fleet's own storefront review
 * asked for: a person scanning a SERP is comparing prices, not reading names.
 *
 * ── Why the photo strip is OUTSIDE the anchor ─────────────────────────────
 *
 * `<ListingCard>` puts its photo inside the card's anchor, because a still
 * `<img>` inside a link is just a bigger link. A `<SkinCarousel>` is not: it
 * is a scroll container with its own tab stop, and a horizontal swipe that
 * ends inside an `<a>` is a swipe the browser may deliver as a click. Putting
 * the strip in the anchor would mean every attempt to look at photo two
 * navigated to the listing — the defect that makes phone galleries unusable.
 *
 * So the strip sits above the anchor as a sibling, exactly as the heart sits
 * below it as a sibling, and for the same class of reason: a link may not
 * contain a control, and a swipeable strip is a control. The anchor still
 * covers the four things that identify the listing — price, title, specs,
 * badges — so the card opens from everything a person reads.
 *
 * ── The two slots, and what they are honestly for ─────────────────────────
 *
 * `sellerSlot` is the seller's name and rating. It is a SLOT because a rating
 * aggregate belongs to `@stapel/reviews-react` and this pair does not import
 * another L2 pair; the container is the seam. **The caveat a host must know:**
 * `<RatingBadge>` FETCHES — one request per card. On a page of twenty results
 * that is twenty requests for a decoration. A container drawing this in a list
 * should render the name plus a bare `<Rate>` from an aggregate the row
 * already carries, and render nothing at all when the row carries none. It
 * lives outside the anchor because a seller's name is usually a link to the
 * seller, and a link inside a link is neither valid nor operable.
 *
 * `actionsRail` is the vertical column at the trailing edge — "call", "write"
 * — filled by the container from `@stapel/chat-react` and from whatever the
 * deployment uses for a phone number. The pair supplies the COLUMN and the
 * favourite heart at the end of it, and nothing else: this package has no
 * conversation and no telephone number, and the search projection carries no
 * phone (gap G-2's neighbour, recorded in the wave spec §4).
 *
 * ── The price trend is a seam over data that does not exist yet ───────────
 *
 * `priceTrend` renders the ref's "was 1 800 000 ₽ ↓". The search projection
 * carries no price history — no `price_was`, no direction — so nothing on a
 * live SERP fills this today (wave gap **G-2**). It ships anyway, and the
 * demos show it against fixture data, because the alternative is a card that
 * has to be re-laid-out the day the projection grows the field. The seam is
 * the honest half; the missing data is written down rather than faked.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Card, Flex, Typography, theme as antdTheme } from "antd";
import { SkinCarousel, SkinTheme } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import { FeatureBadges } from "@stapel/attributes-react/default";
import type { ListingCard as ListingCardData } from "../api/types.js";
import {
  asFeatureDaoList,
  featuresDtoFromDaoList,
  featuresFromDaoList,
} from "../model/features.js";
import type { FeatureCopySource } from "../model/features.js";
import { lifecycleCaption } from "../model/status.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { PriceTrendIcon } from "./icons.js";
import { FavoriteHeart } from "./favorite.js";
import {
  CARD_TARGET_STYLE_HREF,
  CardTarget,
  cardTargetCss,
} from "./ListingCard.js";
import type { ListingCardOpenProps } from "./ListingCard.js";
import { LISTING_PHOTO_ASPECT, ListingPhoto } from "./ListingPhoto.js";
import { ListingPrice } from "./ListingPrice.js";
import type { CategoryFeaturesProp, ThemeModeProp } from "./types.js";

/**
 * A price that moved, as the ref draws it: the old figure struck through and
 * an arrow saying which way.
 *
 * `oldPrice` is a decimal STRING in the listing's own currency — the same
 * dialect `Listing.price` speaks — so it is formatted by the same
 * `<ListingPrice>` and never by a template literal.
 */
export interface ListingPriceTrend {
  /** The previous asking price, as the wire spells money: a decimal string. */
  readonly oldPrice: string;
  /** Which way it moved. `"down"` is the one a classified shouts about. */
  readonly direction: "down" | "up";
}

export interface ListingSerpCardBaseProps
  extends ThemeModeProp,
    CategoryFeaturesProp {
  readonly listing: ListingCardData;
  /**
   * The seller's own one-line summary — "Petrol 1.5 (147 hp), robot, front".
   *
   * A STRING the host derived, not a projection this card reads: the ref's
   * spec line is a deployment's editorial choice about which features belong
   * on a result and in what order, and that is a decision no library can take
   * for a category it has never seen. When the host has no opinion the card
   * falls back to the row's `features_title` — the projection's own summary is
   * a better default line than an empty one (§83: the default skin does the
   * right thing before the host wires anything).
   */
  readonly specsLine?: string;
  /** See the file header — a seam over data the projection does not carry. */
  readonly priceTrend?: ListingPriceTrend;
  /** The seller's name and rating. See the file header for the per-card fetch
   * caveat a container has to avoid. */
  readonly sellerSlot?: ReactNode;
  /** The vertical action column at the trailing edge — call, write. The
   * favourite heart is added at its end by this component. */
  readonly actionsRail?: ReactNode;
  /** Extra chrome above the price (a `promoted` tag from search — DSA Art. 26
   * marking belongs to the pair that receives it). */
  readonly badge?: ReactNode;
  /** Hide the favourite entirely — for a surface where it makes no sense (the
   * owner's own listings). NOT a way to hide it from visitors. */
  readonly showFavorite?: boolean;
}

export type ListingSerpCardProps = ListingSerpCardBaseProps & ListingCardOpenProps;

/** The trailing column. Fixed width contribution: it must not take room from
 * the text as the actions grow. */
const RAIL: CSSProperties = { flex: "0 0 auto" };

/** The reading column. `minWidth: 0` so a long unbroken word cannot push the
 * rail off the card. */
const BODY: CSSProperties = { flex: "1 1 auto", minWidth: 0 };

export function ListingSerpCard(props: ListingSerpCardProps): ReactElement {
  const t = useT();
  const { listing, priceTrend } = props;
  const { token } = antdTheme.useToken();

  const badgeDaos = asFeatureDaoList(listing.features_badges);
  // See `CategoryFeaturesProp`: the option table a stored `select` does not
  // carry, when this surface knows which category it is drawing.
  const copy: FeatureCopySource =
    props.categoryFeatures !== undefined
      ? { categoryFeatures: props.categoryFeatures }
      : {};
  const badgeFeatures = featuresFromDaoList(badgeDaos, copy);
  const badgeValues = featuresDtoFromDaoList(badgeDaos);
  // The fallback spec line when the host derived none: the row's own
  // `features_title` projection, exactly the line `ListingCard` draws.
  const titleDaos =
    props.specsLine !== undefined && props.specsLine.length > 0
      ? []
      : asFeatureDaoList(listing.features_title);

  const status =
    listing.status === undefined ? undefined : lifecycleCaption(listing.status);

  const title = listing.title ?? "";
  const targetLabel =
    title.length > 0 ? title : t(LISTINGS_I18N_KEYS.cardUntitled);
  const photos = listing.images ?? [];
  const currency =
    listing.currency !== undefined ? { currency: listing.currency } : {};

  // A one-photo strip gets neither a peek nor dots: the sliver of a next slide
  // is an affordance for something that is there, and on a single photo it is
  // just a strip of dead space at the trailing edge (`SkinCarousel` says the
  // same thing from its own side).
  const many = photos.length > 1;

  const rail =
    props.actionsRail !== undefined || props.showFavorite !== false ? (
      <Flex
        vertical
        align="flex-end"
        gap={spacing[2]}
        style={RAIL}
        data-testid="listings-serp-actions"
      >
        {props.actionsRail}
        {props.showFavorite === false ? null : (
          <FavoriteHeart
            listingId={listing.id}
            favorited={listing.is_favorited}
            testId="listings-serp-favorite"
          />
        )}
      </Flex>
    ) : null;

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <style href={CARD_TARGET_STYLE_HREF} precedence="default">
        {cardTargetCss()}
      </style>
      <Card
        size="small"
        data-testid="listings-serp-card"
        data-listing-id={listing.id}
        {...(status !== undefined
          ? { "data-listing-status": status.status }
          : {})}
        styles={{ body: { minWidth: 0, padding: token.paddingSM } }}
        style={{ ["--listing-card-focus" as string]: token.colorPrimary }}
      >
        <Flex vertical gap={spacing[3]}>
          {/* The strip is a SIBLING of the anchor, never a child — see the
              file header. A listing with no photos still gets one slide, so
              the card's height does not depend on whether a seller uploaded
              anything. */}
          <SkinCarousel
            label={t(LISTINGS_I18N_KEYS.cardPhotos)}
            aspectRatio={LISTING_PHOTO_ASPECT}
            peek={many}
            dots={many}
            data-testid="listings-serp-photos"
          >
            {photos.length === 0 ? (
              <ListingPhoto
                imageRef={undefined}
                alt={title.length > 0 ? title : String(listing.id)}
              />
            ) : (
              photos.map((reference, index) => (
                <ListingPhoto
                  key={reference}
                  imageRef={reference}
                  alt={t(LISTINGS_I18N_KEYS.detailPhotoAlt, {
                    index: index + 1,
                    total: photos.length,
                  })}
                />
              ))
            )}
          </SkinCarousel>

          <Flex gap={spacing[3]} align="flex-start">
            <Flex vertical gap={spacing[1]} style={BODY}>
              <CardTarget
                {...openProps(props)}
                listingId={listing.id}
                label={targetLabel}
                testId="listings-serp-open"
                bodyTestId="listings-serp-body"
              >
                {props.badge}

                {/* PRICE FIRST, and loud. `fontSize.xl` rather than an antd
                    heading: this is a price, not a section title, and it must
                    not enter the document outline of a page holding twenty of
                    them. */}
                <Flex align="center" gap={spacing[2]} wrap>
                  <Typography.Text
                    strong
                    style={{ fontSize: fontSize.xl.fontSize }}
                    data-testid="listings-serp-price"
                  >
                    <ListingPrice amount={listing.price} {...currency} />
                  </Typography.Text>
                  {priceTrend !== undefined && (
                    <PriceTrendIcon
                      direction={priceTrend.direction}
                      label={t(
                        priceTrend.direction === "down"
                          ? LISTINGS_I18N_KEYS.cardPriceDropped
                          : LISTINGS_I18N_KEYS.cardPriceRaised
                      )}
                    />
                  )}
                </Flex>

                {priceTrend !== undefined && (
                  <Flex
                    align="baseline"
                    gap={spacing[1]}
                    data-testid="listings-serp-old-price"
                  >
                    {/* The strike-through is what a sighted reader sees and
                        nothing a screen reader announces, so the word is on
                        the line too rather than left to the styling. */}
                    <Typography.Text type="secondary">
                      {t(LISTINGS_I18N_KEYS.cardPriceWas)}
                    </Typography.Text>
                    <Typography.Text type="secondary" delete>
                      <ListingPrice amount={priceTrend.oldPrice} {...currency} />
                    </Typography.Text>
                  </Flex>
                )}

                <Typography.Text data-testid="listings-serp-title">
                  {title}
                </Typography.Text>

                {props.specsLine !== undefined && props.specsLine.length > 0 ? (
                  <Typography.Text
                    type="secondary"
                    ellipsis
                    data-testid="listings-serp-specs"
                  >
                    {props.specsLine}
                  </Typography.Text>
                ) : titleDaos.length > 0 ? (
                  <Typography.Text
                    type="secondary"
                    ellipsis
                    data-testid="listings-serp-specs"
                  >
                    <FeatureBadges
                      features={featuresFromDaoList(titleDaos, copy).map(
                        (view) => view.feature,
                      )}
                      values={featuresDtoFromDaoList(titleDaos)}
                    />
                  </Typography.Text>
                ) : null}

                {badgeFeatures.length > 0 ? (
                  <FeatureBadges
                    features={badgeFeatures.map((view) => view.feature)}
                    values={badgeValues}
                  />
                ) : null}
              </CardTarget>

              {/* Outside the anchor, both of them: a seller line usually holds
                  a link to the seller, and the place is the last thing read
                  rather than part of what the card is called. */}
              {props.sellerSlot ?? null}

              {listing.location_label !== undefined &&
              listing.location_label.length > 0 ? (
                <Typography.Text
                  type="secondary"
                  data-testid="listings-serp-location"
                >
                  {listing.location_label}
                </Typography.Text>
              ) : null}
            </Flex>

            {rail}
          </Flex>
        </Flex>
      </Card>
    </SkinTheme>
  );
}

/**
 * The three-armed open union, narrowed back out of this card's own props.
 *
 * Spreading `props` straight into `<CardTarget>` would hand it `listing`,
 * `sellerSlot` and the rest as DOM attributes on the arms that render a plain
 * `<a>`; picking the union's members explicitly keeps the anchor clean and
 * keeps exactly one of the three arms reachable.
 */
function openProps(props: ListingSerpCardProps): ListingCardOpenProps {
  if (props.href !== undefined) {
    return props.linkComponent !== undefined
      ? { href: props.href, linkComponent: props.linkComponent }
      : { href: props.href };
  }
  if (props.onOpen !== undefined) return { onOpen: props.onOpen };
  return {};
}
