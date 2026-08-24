/**
 * `<ListingCard>` — the one component of this pair that another pair renders.
 *
 * `@stapel/search-react` takes a `renderCard` slot and the container fills it
 * with this (spec §3.7 / §6.2 item 1). The two pairs never import each other;
 * the CONTAINER is the seam, which is why this component takes a plain card
 * row and a plain `href` rather than reaching for a router.
 *
 * ── One click, one navigation ──────────────────────────────────────────────
 *
 * `href` and `onOpen` used to be two optional props, and a card given both
 * navigated TWICE: the handler ran, and the browser then followed the anchor
 * that was still on the button. They are now three arms of a union — link,
 * button, or neither — and `linkComponent` rides on the link arm so a
 * container can hand in its router's `<Link>` and keep the anchor.
 *
 * ── What it renders without asking the server anything else ────────────────
 *
 * Badges. `features_badges` is a stored DAO projection, and a DAO carries the
 * display config beside the value, so `formatFeatureValue` can render
 * "1200 W" from the row alone — no category fetch, no second request per
 * card. That property is the whole reason the projection exists, and it is
 * what makes a grid of forty cards cost one query.
 *
 * ── The heart is never hidden ──────────────────────────────────────────────
 *
 * A visitor sees it, blocked, with the reason IN WORDS beside it and the
 * sign-in link the container supplies (`signIn`, typically `?next=<current>`).
 * Hiding it would teach nobody that favourites exist (private-space canon
 * §6.3, spec §6.2 item 6) — and until 0.3.0 the reason lived only in a tooltip
 * on a disabled button, which receives no pointer events in any browser: a
 * reason nobody could read, and no door to walk through.
 */
import type { ReactElement, ReactNode } from "react";
import { Button, Card, Flex, Tooltip, Typography } from "antd";
import { useActionGate, useT } from "@stapel/core";
import type { LinkComponent, SignInCtaProp } from "@stapel/core";
import { FeatureBadges } from "@stapel/attributes-react/default";
import type { ListingCard as ListingCardData } from "../api/types.js";
import { asFeatureDaoList, featuresDtoFromDaoList, featuresFromDaoList } from "../model/features.js";
import { lifecycleCaption } from "../model/status.js";
import { useFavoriteToggle } from "../headless/Favorites.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { HeartIcon } from "./icons.js";
import { SignInLink } from "./SignInLink.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { ListingsSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

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
 * `"tooltip"` moves the reason onto the control it is about. Not the pre-0.3.0
 * defect it resembles: the disabled button still sits inside the `<span>`
 * wrapper that makes the tooltip reachable by pointer AND by keyboard, so the
 * reason is readable — it is simply not printed forty times.
 *
 * Which one is a decision about the SURFACE, not about whether the reason
 * matters, and the surface is the container's to make (the same argument as
 * `<SearchResultsPane degradationNotice>`).
 */
export type ListingCardBlockedReason = "text" | "line" | "tooltip";

export interface ListingCardBaseProps extends ThemeModeProp, SignInCtaProp {
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
 * The one control that opens the card: an anchor, a button, or nothing.
 *
 * Exactly one of the three renders, so exactly one navigation happens per
 * click. That is the whole fix — the branch below has no arm in which both a
 * handler and an `href` reach the DOM.
 */
function OpenControl(
  props: ListingCardOpenProps & { readonly listingId: number }
): ReactElement | null {
  const t = useT();
  const label = t(LISTINGS_I18N_KEYS.cardOpen);

  if (props.href !== undefined) {
    const Link = props.linkComponent;
    // The host's component is rendered as it comes: this pair has no CSS and
    // no way to hand antd's button styling to a foreign element, and a wrapper
    // element around a link is a click target that is not the link. A host
    // that wants the antd look styles its own `<Link>` — it is one component,
    // written once, and it is already the thing that knows the design system.
    return Link !== undefined ? (
      <Link
        href={props.href}
        aria-label={label}
        data-testid="listings-card-open"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {label}
      </Link>
    ) : (
      <Button
        size="small"
        type="link"
        href={props.href}
        data-testid="listings-card-open"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {label}
      </Button>
    );
  }

  if (props.onOpen !== undefined) {
    const onOpen = props.onOpen;
    return (
      <Button
        size="small"
        type="link"
        data-testid="listings-card-open"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
        onClick={() => {
          onOpen(props.listingId);
        }}
      >
        {label}
      </Button>
    );
  }

  return null;
}

export function ListingCard(props: ListingCardProps): ReactElement {
  const t = useT();
  const { listing } = props;
  const favorite = useFavoriteToggle(listing.id, listing.is_favorited);

  const badgeDaos = asFeatureDaoList(listing.features_badges);
  const badgeFeatures = featuresFromDaoList(badgeDaos);
  const badgeValues = featuresDtoFromDaoList(badgeDaos);
  const titleDaos = asFeatureDaoList(listing.features_title);

  const status = listing.status === undefined ? undefined : lifecycleCaption(listing.status);
  const price =
    listing.price !== undefined && listing.price.length > 0
      ? `${listing.price} ${listing.currency ?? ""}`.trim()
      : t(LISTINGS_I18N_KEYS.cardPriceAbsent);

  const favoriteGate = useActionGate(favorite.gate);
  const blockedReason = props.blockedReason ?? "text";

  const favoriteLabel = t(
    favorite.favorited
      ? LISTINGS_I18N_KEYS.cardFavoriteRemove
      : LISTINGS_I18N_KEYS.cardFavoriteAdd
  );

  return (
    <ListingsSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        size="small"
        data-testid="listings-card"
        data-listing-id={listing.id}
        {...(status !== undefined
          ? { "data-listing-status": status.status }
          : {})}
        cover={
          <ListingPhoto
            imageRef={listing.images?.[0]}
            alt={listing.title ?? String(listing.id)}
            style={{ aspectRatio: "4 / 3" }}
          />
        }
      >
        <Flex vertical gap={4}>
          {props.badge}

          <Typography.Text strong data-testid="listings-card-price">
            {price}
          </Typography.Text>

          <Typography.Text ellipsis data-testid="listings-card-title">
            {listing.title ?? ""}
          </Typography.Text>

          {/* The title features are a stored projection too — the seller's
              "1.5 TB, black" line, already ordered by the server. */}
          {titleDaos.length > 0 ? (
            <Typography.Text type="secondary" ellipsis>
              <FeatureBadges
                features={featuresFromDaoList(titleDaos)
                  .map((view) => view.feature)}
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

          <Flex gap={8} align="center">
            <OpenControl {...props} listingId={listing.id} />

            {props.showFavorite === false ? null : (
              <Tooltip
                title={
                  favorite.gate.available
                    ? favoriteLabel
                    : t(favorite.gate.block.code, favorite.gate.block.params)
                }
              >
                {/* A disabled antd Button swallows pointer events, so the
                    tooltip needs the wrapper to hear them — which is also
                    what makes the REASON reachable by keyboard. */}
                <span data-testid="listings-card-favorite-wrap">
                  <Button
                    size="small"
                    disabled={!favorite.gate.available}
                    aria-label={favoriteLabel}
                    aria-pressed={favorite.favorited}
                    data-testid="listings-card-favorite"
                    data-favorited={String(favorite.favorited)}
                    data-analytics="none"
                    data-analytics-reason="business action — host app wraps with its own tracked()"
                    onClick={favorite.toggle}
                    icon={<HeartIcon filled={favorite.favorited} />}
                  />
                </span>
              </Tooltip>
            )}
          </Flex>

          {/* The reason IN WORDS, plus the door. A tooltip on a disabled
              button is a reason nobody can read (core's actionGate.ts says so
              in as many words), and a reason with no next action leaves the
              visitor hunting for the header — which is what the storefront
              had to write a paragraph about instead of shipping the screen.

              `blockedReason` is the volume knob, and only the volume: the
              reason is on the screen under all three settings — printed here,
              or on the control itself through the tooltip above, which the
              `<span>` wrapper keeps reachable. See the type's own docstring
              for why a grid gets a quieter one than a single card. */}
          {props.showFavorite === false ||
          favoriteGate.reason === undefined ||
          blockedReason === "tooltip" ? null : (
            <Typography.Text
              type="secondary"
              data-testid="listings-card-favorite-blocked"
            >
              {favoriteGate.reason}
              {blockedReason === "line" ? null : (
                <SignInLink cta={props.signIn} testId="listings-card-sign-in" />
              )}
            </Typography.Text>
          )}
        </Flex>
      </Card>
    </ListingsSkinTheme>
  );
}
