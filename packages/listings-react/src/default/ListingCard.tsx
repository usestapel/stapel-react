/**
 * `<ListingCard>` — the one component of this pair that another pair renders.
 *
 * `@stapel/search-react` takes a `renderCard` slot and the container fills it
 * with this (spec §3.7 / §6.2 item 1). The two pairs never import each other;
 * the CONTAINER is the seam, which is why this component takes a plain card
 * row and a plain `href` rather than reaching for a router.
 *
 * ── The CARD is the link ───────────────────────────────────────────────────
 *
 * Owner ruling (2026-08-28, from the live stand): a card carrying its own
 * "view" button is plainly wrong. The card used to render a separate "Open"
 * control under its own content — a full-width primary button captioned with
 * `listings.card.open` — so a person looking at a photo, a price and a title
 * had to find and press a fourth thing to act on the three they were reading.
 * Nothing on a classified works that way: the card IS the target, and the only
 * separate control on it is the favourite heart.
 *
 * So the price, the title, the badges and the location live INSIDE one anchor
 * that covers the whole card, and `listings.card.open` is retired rather than
 * left orphaned in three catalogues.
 *
 * What that must not cost is the anchor semantics won earlier: this is a real
 * `<a href>`, so middle-click opens a tab, ⌘-click opens a tab, "copy link
 * address" works and a crawler can follow it. It is NOT an `onClick` on a div,
 * which is the shape every "whole card clickable" rewrite reaches for first
 * and which has none of those properties.
 *
 * ── One click, one navigation ──────────────────────────────────────────────
 *
 * `href` and `onOpen` used to be two optional props, and a card given both
 * navigated TWICE: the handler ran, and the browser then followed the anchor
 * that was still on the button. They are now three arms of a union — link,
 * button, or neither — and `linkComponent` rides on the link arm so a
 * container can hand in its router's `<Link>` and keep the anchor.
 *
 * ── The accessible name is the TITLE, and only the title ───────────────────
 *
 * An anchor's name is computed from its contents unless it is given one, and
 * the contents here are a photo, a price, three badges and a place: a screen
 * reader reading a list of forty of those announces forty paragraphs. The
 * anchor therefore carries an explicit `aria-label` — the listing's title,
 * nothing else — and everything inside it stays readable by ordinary browsing.
 * A listing with no title falls back to `listings.card.untitled`, because a
 * link announced as nothing is worse than one announced as untitled.
 *
 * ── The photos moved OUT of the anchor, and the card became a ROW ─────────
 *
 * Both from the same measurement of the live desktop SERP, in list view:
 * **one card per screen** — 974×835, of which the photograph was 974×731 —
 * showing a SINGLE photo, with no carousel, and that photo inside the anchor.
 * The phone card beside it was correct on every count.
 *
 * The photo used to be inside the anchor on the argument that a still `<img>`
 * in a link is just a bigger link, which is true and stops being true the
 * moment there is more than one photo: a swipeable strip is a control, a link
 * may not contain one, and a horizontal swipe that ends inside an `<a>` is a
 * swipe the browser may deliver as a click. So the strip is a SIBLING of the
 * anchor — the arrangement `<ListingSerpCard>` has always used, and the reason
 * the phone gallery works — and the anchor still covers everything a person
 * READS. `<ListingPhotoStrip>` is the one gallery both cards draw.
 *
 * The row is the other half. A grid card handed a full-page-wide track keeps
 * its shape and becomes a banner; this card now asks its OWN width
 * (`@container`, see {@link LISTING_CARD_ROW_MIN}) and lays the photo beside
 * the text above 560px. In a grid its column is never that wide, so nothing
 * about the grid changes; in a list several rows fit a screen, which is the
 * only reason a list exists.
 *
 * ── Why the heart is a row under the card and not floating on the photo ────
 *
 * Because for a signed-out visitor — which is most of the traffic a storefront
 * gets — the heart is BLOCKED, and a blocked control states its reason as text
 * beside it. There is nowhere to put that sentence on top of a photograph. The
 * heart therefore sits in its own row beneath the content, outside the anchor
 * (a button inside a link is neither valid nor operable), where the reason has
 * a line to live on.
 *
 * ── What it renders without asking the server anything else ────────────────
 *
 * Badges. `features_badges` is a stored DAO projection, and a DAO carries the
 * display config beside the value, so `formatFeatureValue` can render
 * "1200 W" from the row alone — no category fetch, no second request per
 * card. That property is the whole reason the projection exists, and it is
 * what makes a grid of forty cards cost one query.
 *
 * ── The heart is never hidden, and never explained by hover ────────────────
 *
 * A visitor sees it, blocked, with the reason IN WORDS beside it and the
 * sign-in link the container supplies (`signIn`, typically `?next=<current>`).
 * Hiding it would teach nobody that favourites exist (private-space canon
 * §6.3, spec §6.2 item 6). The reason itself goes through the shared
 * `<GatedControl>`, which renders it as text linked by `aria-describedby` —
 * a disabled antd button receives no pointer events and is not focusable, so
 * the `Tooltip` this component used to offer as a "quieter" volume was a
 * reason nobody could read on any device. That arm is gone; `blockedReason`
 * is "text" (reason + door), "line" (reason alone, for a grid), or
 * "popover" — the reason and the door disclosed on the heart itself, with
 * the reason still in the accessibility tree. The third arm is NOT the old
 * tooltip back under a new name; see `ListingCardBlockedReason` for what
 * changed and why.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Card, Flex, Typography, theme as antdTheme } from "antd";
import { GatedControl, SkinTheme } from "@stapel/tokens-antd/skin";
import { useActionGate, useT } from "@stapel/core";
import type { LinkComponent, SignInCtaProp } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { FeatureBadges } from "@stapel/attributes-react/default";
import type { ListingCard as ListingCardData } from "../api/types.js";
import { asFeatureDaoList, featuresDtoFromDaoList, featuresFromDaoList } from "../model/features.js";
import type { FeatureCopySource } from "../model/features.js";
import { lifecycleCaption } from "../model/status.js";
import { useFavoriteToggle } from "../headless/Favorites.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { GateReasonPopover } from "./GateReasonPopover.js";
import { HeartIcon } from "./icons.js";
import { SignInLink } from "./SignInLink.js";
import { ListingPhotoStrip } from "./ListingPhoto.js";
import { ListingPrice } from "./ListingPrice.js";
import type { CategoryFeaturesProp, ThemeModeProp } from "./types.js";

/**
 * How the card opens — ONE of three, and the type says so.
 *
 * It used to be two optional props, and a caller that passed both got two
 * navigations for one click: the handler ran and the browser then followed the
 * anchor anyway. The storefront worked around it by passing `onOpen` only,
 * which cost it a real anchor (no middle-click, no "open in new tab", nothing
 * for a crawler to follow) on the most linkable element in the app.
 *
 * So the union has three arms and no fourth: a link, a button, or neither.
 * `linkComponent` belongs to the link arm because it IS the link — handing a
 * `<Link>` to a card that navigates by callback would be two answers to one
 * question again.
 */
export type ListingCardOpenProps =
  | {
      /** Where the card leads. A plain path — the pair never calls
       * `window.location` and never builds a router descriptor. */
      readonly href: string;
      /** The host's `<Link>`, so the click stays inside the SPA. Absent: an
       * antd link-button carrying the `href`, which reloads the page in a
       * router app — correct, just not fast. */
      readonly linkComponent?: LinkComponent;
      readonly onOpen?: undefined;
    }
  | {
      /** The card opens by callback: rendered as a button, with no `href` for
       * the browser to follow after the handler has already navigated. */
      readonly onOpen: (id: number) => void;
      readonly href?: undefined;
      readonly linkComponent?: undefined;
    }
  | {
      /** No open control at all — a card inside a screen that is already the
       * listing. */
      readonly href?: undefined;
      readonly onOpen?: undefined;
      readonly linkComponent?: undefined;
    };

/**
 * How loudly a blocked favourite states its reason on THIS surface.
 *
 * `"text"` (the default) is the sentence under the controls, with the sign-in
 * door beside it — the right volume for a card that stands alone.
 *
 * `"line"` collapses it to the reason alone, no door: a grid of forty cards
 * repeating "sign in to do this — sign in" forty times is not forty pieces of
 * help, it is the loudest thing on the page, and every one of those doors
 * leads where the header's own sign-in button already leads.
 *
 * `"popover"` takes the standing copy out of the card's layout entirely: the
 * reason and the door render in a disclosure anchored to the heart itself,
 * opening on hover AND focus AND click/tap, while a visually-hidden copy of
 * the reason stays wired to the button via `aria-describedby`.
 *
 * This docstring used to end "there is no third setting", on the argument
 * that the only way to be quieter than a line of text is to hide the reason
 * behind hover, and hover does not exist on the device most of these cards
 * are read on. Half of that argument held up and half was answered. What
 * held: the desktop walk measured the standing caption printed under EVERY
 * card — 24 copies per screen — and the product ruling is that the door
 * belongs on interaction, not as standing copy; a pooled scope and a
 * per-card line are both still STANDING copy, so neither volume above can
 * satisfy it. What was answered: the disclosure is not hover-gated (a tap
 * opens it, so a thumb is one gesture from the reason — the same distance
 * as a cursor), its anchor is never an html-disabled control (the events
 * arrive), and the reason never leaves the accessibility tree. Interaction
 * disclosure keeps the reason one gesture away on both pointer and touch;
 * what it stops doing is shouting it twenty-four times. Mechanics in
 * `GateReasonPopover`.
 */
export type ListingCardBlockedReason = "text" | "line" | "popover";

/** The class the whole-card target carries, for {@link cardTargetCss}. */
export const CARD_TARGET_CLASS = "stapel-listing-card-target";
/** The class the card's OUTER box carries — the size container the row layout
 * is asked about. A container cannot answer a query about itself, which is why
 * this is a wrapper and not the frame. */
export const CARD_QUERY_CLASS = "stapel-listing-card-q";
/** The class the media/reading frame carries. */
export const CARD_FRAME_CLASS = "stapel-listing-card-frame";
/** The class the photo strip's box carries. */
export const CARD_MEDIA_CLASS = "stapel-listing-card-media";
/** The class the reading column carries. */
export const CARD_MAIN_CLASS = "stapel-listing-card-main";
/** Added to the frame by a card whose media is FULL-BLEED when stacked
 * (`<ListingCard>`), so the row arm gets the inset the stacked arm does not. */
export const CARD_BLEED_CLASS = "stapel-listing-card-bleed";

/** The `href` the hoisted card stylesheet is deduplicated by. */
export const CARD_TARGET_STYLE_HREF = "stapel-listings-card-target";

/**
 * The card's own inline size above which it stops being a card and becomes a
 * ROW.
 *
 * Measured on the live desktop SERP in "list" view: **one card per screen**,
 * 974×835, of which the photograph was 974×731 — a grid card handed a
 * full-page track and asked to keep its shape. A shopper comparing offers got
 * one offer per scroll.
 *
 * 560px is the width at which a 4:3 photo stops being a banner: below it a
 * two-column row leaves the text nothing, above it the photo is a thumbnail
 * beside a paragraph. A `@container` query rather than a media query because
 * the card does not know the viewport and must not care: the same card is a
 * grid cell 300px wide on a 1440px screen and a full-width row on a 700px one,
 * and only its OWN width decides which it is.
 */
export const LISTING_CARD_ROW_MIN = 560;

/** The photo's width in the row arm. Wide enough to read the goods, narrow
 * enough that several rows fit a screen — the whole point of a list. */
export const LISTING_CARD_ROW_MEDIA = 260;

/**
 * The one rule an inline style cannot express: `:focus-visible`.
 *
 * A whole-card link is the largest focus target on a results page and it must
 * SHOW that it has focus — a keyboard visitor tabbing a grid of forty cards
 * with no ring has no idea which one Enter will open. The outline is drawn
 * from the theme's own focus colour, which arrives as a custom property on the
 * element (the sheet is static, so one hoisted copy serves either theme).
 *
 * `--listing-*` rather than `--stapel-*`: the `--stapel-` namespace is the
 * design system's ROLE catalogue and this is a component's private plumbing.
 */
export function cardTargetCss(): string {
  const q = `.${CARD_QUERY_CLASS}`;
  const frame = `.${CARD_FRAME_CLASS}`;
  const media = `.${CARD_MEDIA_CLASS}`;
  const main = `.${CARD_MAIN_CLASS}`;
  const bleed = `.${CARD_BLEED_CLASS}`;
  return [
    `.${CARD_TARGET_CLASS}{display:block;color:inherit;text-decoration:none}`,
    `.${CARD_TARGET_CLASS}:focus-visible{outline:2px solid var(--listing-card-focus);outline-offset:2px}`,
    // The card asks about its OWN width, not the window's — see
    // `LISTING_CARD_ROW_MIN`.
    `${q}{container-type:inline-size}`,
    `${frame}{display:flex;flex-direction:column;min-inline-size:0}`,
    `${media}{min-inline-size:0}`,
    `${main}{display:flex;flex-direction:column;flex:1 1 auto;min-inline-size:0}`,
    // The row arm. `align-items:flex-start` so a short text column does not
    // stretch the photo, and a fixed media basis so the picture cannot grow
    // into the 974px banner the live SERP was measured at.
    `@container (min-width:${String(LISTING_CARD_ROW_MIN)}px){` +
      `${frame}{flex-direction:row;align-items:flex-start}` +
      `${media}{flex:0 0 ${String(LISTING_CARD_ROW_MEDIA)}px;` +
      `max-inline-size:${String(LISTING_CARD_ROW_MEDIA)}px}` +
      // A full-bleed stacked card has no padding of its own to give the row
      // arm, so the row arm states its own; the reading column's padding is
      // what separates the two.
      `${bleed}{padding-block:var(--listing-card-inset);` +
      `padding-inline-start:var(--listing-card-inset)}` +
      `}`,
  ].join("");
}

/** The anchor: a block that inherits the card's own type colour rather than
 * painting every card's contents link-blue. */
const TARGET_STYLE: CSSProperties = {
  display: "block",
  color: "inherit",
  textDecoration: "none",
};

/** The callback arm's button, reset to look like the anchor does. A card that
 * is a target on one deployment and a card-plus-a-button on another would be
 * two different products. */
const BUTTON_TARGET_STYLE: CSSProperties = {
  ...TARGET_STYLE,
  width: "100%",
  padding: 0,
  border: "none",
  background: "none",
  font: "inherit",
  textAlign: "start",
  cursor: "pointer",
};

export interface ListingCardBaseProps
  extends ThemeModeProp,
    SignInCtaProp,
    CategoryFeaturesProp {
  readonly listing: ListingCardData;
  /** See {@link ListingCardBlockedReason}. Default `"text"`. */
  readonly blockedReason?: ListingCardBlockedReason;
  /** Extra chrome the container adds (a `promoted` tag from search, say —
   * DSA Art. 26 marking belongs to the pair that receives it). */
  readonly badge?: ReactNode;
  /** Hide the favourite control entirely — for a context where it makes no
   * sense (the owner's own dashboard). NOT a way to hide it from visitors. */
  readonly showFavorite?: boolean;
}

export type ListingCardProps = ListingCardBaseProps & ListingCardOpenProps;

/**
 * The card's own body, wrapped in whatever makes it openable: an anchor, a
 * button, or nothing at all.
 *
 * Exactly one of the three renders, so exactly one navigation happens per
 * click — the branch below has no arm in which both a handler and an `href`
 * reach the DOM.
 *
 * The BUTTON arm exists for a container that routes by callback. It wraps the
 * same content in a `<button>` reset to look like nothing, rather than drawing
 * a separate captioned control: a card that is a target on one deployment and
 * a card-plus-a-button on another would be two different products.
 *
 * Exported for this pair's OTHER card surfaces (`<ListingSerpCard>`,
 * `<ListingFeedCard>`) and for no one else — it is deliberately absent from
 * `src/default/index.ts`. Three cards each re-deriving "which of the three
 * arms is this" is three places for the double-navigation defect to come back;
 * one function is one place. The card surfaces differ in what they PUT inside
 * the target, never in how the target is made.
 */
export function CardTarget(
  props: ListingCardOpenProps & {
    readonly listingId: number;
    readonly label: string;
    /** The target's own test id. Each card surface names its own, so a screen
     * holding two kinds of card does not hand a test two elements under one
     * name. Default: the original card's. */
    readonly testId?: string;
    /** The body's test id on the arm where nothing opens. */
    readonly bodyTestId?: string;
    readonly children: ReactNode;
  }
): ReactElement {
  const { label, children } = props;
  const testId = props.testId ?? "listings-card-open";

  if (props.href !== undefined) {
    const Link = props.linkComponent;
    // The host's component is rendered as it comes: this pair has no CSS and
    // no way to hand its own styling to a foreign element. A wrapper element
    // around a link would be a click target that is not the link.
    return Link !== undefined ? (
      <Link
        href={props.href}
        aria-label={label}
        className={CARD_TARGET_CLASS}
        data-testid={testId}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {children}
      </Link>
    ) : (
      <a
        href={props.href}
        aria-label={label}
        className={CARD_TARGET_CLASS}
        style={TARGET_STYLE}
        data-testid={testId}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {children}
      </a>
    );
  }

  if (props.onOpen !== undefined) {
    const onOpen = props.onOpen;
    return (
      <button
        type="button"
        aria-label={label}
        className={CARD_TARGET_CLASS}
        style={BUTTON_TARGET_STYLE}
        data-testid={testId}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
        onClick={() => {
          onOpen(props.listingId);
        }}
      >
        {children}
      </button>
    );
  }

  // No open control at all — a card inside a screen that IS the listing.
  return (
    <div data-testid={props.bodyTestId ?? "listings-card-body"}>{children}</div>
  );
}

export function ListingCard(props: ListingCardProps): ReactElement {
  const t = useT();
  const { listing } = props;
  const favorite = useFavoriteToggle(listing.id, listing.is_favorited);
  const { token } = antdTheme.useToken();

  const badgeDaos = asFeatureDaoList(listing.features_badges);
  // The category's own option table, when the surface has it: a stored
  // `select` carries no table of its own, so without this a badge prints the
  // storage slug. Absent on a mixed grid, which is why it is optional.
  const copy: FeatureCopySource =
    props.categoryFeatures !== undefined
      ? { categoryFeatures: props.categoryFeatures }
      : {};
  const badgeFeatures = featuresFromDaoList(badgeDaos, copy);
  const badgeValues = featuresDtoFromDaoList(badgeDaos);
  const titleDaos = asFeatureDaoList(listing.features_title);

  const status = listing.status === undefined ? undefined : lifecycleCaption(listing.status);

  const favoriteGate = useActionGate(favorite.gate);
  const blockedReason = props.blockedReason ?? "text";

  const favoriteLabel = t(
    favorite.favorited
      ? LISTINGS_I18N_KEYS.cardFavoriteRemove
      : LISTINGS_I18N_KEYS.cardFavoriteAdd
  );

  const title = listing.title ?? "";
  // The anchor's name is the TITLE and nothing else. A card with no title is
  // still a link, and a link announced as nothing is worse than one announced
  // as untitled.
  const targetLabel =
    title.length > 0 ? title : t(LISTINGS_I18N_KEYS.cardUntitled);

  /**
   * Everything a person READS on the card, in the order a classified reads it:
   * price, title, the seller's own spec line, the badges, the place. The
   * photos are not here — they are the strip beside this, outside the anchor.
   *
   * The search projection carries `title`, `price`, `currency`,
   * `location_label`, `image` and `published_at` and NO feature badges — so
   * every line below is conditional and the card has to look deliberate with
   * all of them absent. That is why the photo and the price carry the layout:
   * they are the two fields a result always has.
   */
  const content = (
    <Flex
      vertical
      gap={spacing[1]}
      style={{ minWidth: 0, padding: token.paddingSM }}
    >
      {props.badge}

      <Typography.Text strong data-testid="listings-card-price">
        <ListingPrice
          amount={listing.price}
          {...(listing.currency !== undefined ? { currency: listing.currency } : {})}
        />
      </Typography.Text>

      <Typography.Text ellipsis data-testid="listings-card-title">
        {title}
      </Typography.Text>

      {/* The title features are a stored projection too — the seller's
          "1.5 TB, black" line, already ordered by the server. */}
      {titleDaos.length > 0 ? (
        <Typography.Text type="secondary" ellipsis>
          <FeatureBadges
            features={featuresFromDaoList(titleDaos, copy).map(
              (view) => view.feature
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

      {listing.location_label !== undefined &&
      listing.location_label.length > 0 ? (
        <Typography.Text type="secondary" data-testid="listings-card-location">
          {listing.location_label}
        </Typography.Text>
      ) : null}
    </Flex>
  );

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
        data-testid="listings-card"
        data-listing-id={listing.id}
        {...(status !== undefined
          ? { "data-listing-status": status.status }
          : {})}
        // The body's own padding is zero because the frame fills the card and
        // the photo runs edge to edge when it is stacked: padding here would
        // be a strip of card around a picture. The text block inside the
        // anchor carries the same padding back, from the same token, and the
        // row arm states its own inset (`--listing-card-inset`).
        styles={{ body: { minWidth: 0, padding: 0 } }}
        style={{
          ["--listing-card-focus" as string]: token.colorPrimary,
          ["--listing-card-inset" as string]: `${String(token.paddingSM)}px`,
        }}
      >
        <div className={CARD_QUERY_CLASS}>
          <div className={`${CARD_FRAME_CLASS} ${CARD_BLEED_CLASS}`}>
            {/* The photos, OUTSIDE the anchor — see `<ListingPhotoStrip>`.
                A swipeable strip is a control, and a link may not contain
                one; the anchor still covers everything a person reads. */}
            <div className={CARD_MEDIA_CLASS}>
              <ListingPhotoStrip
                images={listing.images ?? []}
                title={title.length > 0 ? title : String(listing.id)}
                testId="listings-card-photos"
              />
            </div>

            <div className={CARD_MAIN_CLASS}>
              <CardTarget {...props} listingId={listing.id} label={targetLabel}>
                {content}
              </CardTarget>

              {/* The heart, and only the heart, is a separate CONTROL outside the
                  anchor: a button inside a link is neither valid HTML nor operable.
                  Its refusal gets a line of its own here, which is the whole reason
                  it is a row under the card rather than a glyph floating on the
                  photograph. */}
              {props.showFavorite === false ? null : (
                <div
                  style={{
                    paddingInline: token.paddingSM,
                    paddingBlockEnd: token.paddingSM,
                  }}
                >
                  {blockedReason === "popover" &&
                  favoriteGate.reason !== undefined ? (
                    /* The third volume: nothing standing in the layout. The
                       heart is `aria-disabled`, NOT `disabled` — the gate
                       already refuses the action (`toggle` is a no-op while
                       blocked), and an html-disabled button would swallow
                       the hover, the focus and the tap the disclosure opens
                       on, which is the exact grave the old Tooltip died in. */
                    <GateReasonPopover
                      reason={favoriteGate.reason}
                      cta={props.signIn}
                      testId="listings-card-favorite-reason"
                      signInTestId="listings-card-sign-in"
                    >
                      {(bind) => (
                        <Flex justify="flex-end" style={{ width: "100%" }}>
                          <Button
                            aria-disabled
                            {...bind}
                            aria-label={favoriteLabel}
                            aria-pressed={favorite.favorited}
                            data-testid="listings-card-favorite"
                            data-favorited={String(favorite.favorited)}
                            data-analytics="none"
                            data-analytics-reason="business action — host app wraps with its own tracked()"
                            onClick={favorite.toggle}
                            icon={<HeartIcon filled={favorite.favorited} />}
                          />
                        </Flex>
                      )}
                    </GateReasonPopover>
                  ) : (
                    <>
                      <GatedControl
                        gate={favorite.gate}
                        testId="listings-card-actions"
                        style={{ width: "100%" }}
                      >
                        {(bind) => (
                          <Flex justify="flex-end" style={{ width: "100%" }}>
                            <Button
                              disabled={bind.disabled}
                              data-disabled-reason="the enclosing <GatedControl> renders the gate's reason beside this button"
                              {...(bind["aria-describedby"] !== undefined
                                ? { "aria-describedby": bind["aria-describedby"] }
                                : {})}
                              aria-label={favoriteLabel}
                              aria-pressed={favorite.favorited}
                              data-testid="listings-card-favorite"
                              data-favorited={String(favorite.favorited)}
                              data-analytics="none"
                              data-analytics-reason="business action — host app wraps with its own tracked()"
                              onClick={favorite.toggle}
                              icon={<HeartIcon filled={favorite.favorited} />}
                            />
                          </Flex>
                        )}
                      </GatedControl>

                      {/* The door. `GatedControl` above already prints the reason and
                          wires `aria-describedby` to it; what it cannot know is WHERE a
                          visitor signs in, which is the container's business and arrives
                          as `signIn`. On a grid `blockedReason="line"` drops the door and
                          keeps the sentence — twenty-four doors to one place is not
                          twenty-four pieces of help. */}
                      {favoriteGate.reason === undefined || blockedReason === "line" ? null : (
                        <Typography.Text
                          type="secondary"
                          data-testid="listings-card-favorite-blocked"
                        >
                          <SignInLink cta={props.signIn} testId="listings-card-sign-in" />
                        </Typography.Text>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </SkinTheme>
  );
}
