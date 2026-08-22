/**
 * `<ListingCard>` — the one component of this pair that another pair renders.
 *
 * `@stapel/search-react` takes a `renderCard` slot and the container fills it
 * with this (spec §3.7 / §6.2 item 1). The two pairs never import each other;
 * the CONTAINER is the seam, which is why this component takes a plain card
 * row and a plain `href`/`onOpen` rather than reaching for a router.
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
 * A visitor sees it, blocked, with the reason and the sign-in CTA the
 * container attaches (`?next=`). Hiding it would teach nobody that
 * favourites exist (private-space canon §6.3, spec §6.2 item 6).
 */
import type { ReactElement, ReactNode } from "react";
import { Button, Card, Flex, Tooltip, Typography } from "antd";
import { useT } from "@stapel/core";
import { FeatureBadges } from "@stapel/attributes-react/default";
import type { ListingCard as ListingCardData } from "../api/types.js";
import { asFeatureDaoList, featuresDtoFromDaoList, featuresFromDaoList } from "../model/features.js";
import { lifecycleCaption } from "../model/status.js";
import { useFavoriteToggle } from "../headless/Favorites.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { HeartIcon } from "./icons.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { ListingsSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface ListingCardProps extends ThemeModeProp {
  readonly listing: ListingCardData;
  /** Where the card leads. The container owns routing, so this is a plain
   * href a `<Link>` or an `<a>` can carry — the pair never calls
   * `window.location`. */
  readonly href?: string;
  /** Called instead of following `href`, for a host with its own navigation. */
  readonly onOpen?: (id: number) => void;
  /** Extra chrome the container adds (a `promoted` tag from search, say —
   * DSA Art. 26 marking belongs to the pair that receives it). */
  readonly badge?: ReactNode;
  /** Hide the favourite control entirely — for a context where it makes no
   * sense (the owner's own dashboard). NOT a way to hide it from visitors. */
  readonly showFavorite?: boolean;
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
            {props.href !== undefined || props.onOpen !== undefined ? (
              <Button
                size="small"
                type="link"
                {...(props.href !== undefined ? { href: props.href } : {})}
                data-testid="listings-card-open"
                data-analytics="none"
                data-analytics-reason="business action — host app wraps with its own tracked()"
                onClick={() => {
                  props.onOpen?.(listing.id);
                }}
              >
                {t(LISTINGS_I18N_KEYS.cardOpen)}
              </Button>
            ) : null}

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
        </Flex>
      </Card>
    </ListingsSkinTheme>
  );
}
