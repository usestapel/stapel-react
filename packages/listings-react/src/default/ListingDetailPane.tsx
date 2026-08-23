/**
 * `<ListingDetailPane>` — the listing page.
 *
 * Four distinct absences, four distinct sentences, and the whole point of the
 * component is that none of them collapses into another:
 *
 *   loading            — we are asking
 *   failed             — we could not ask   (retry, never "nothing here")
 *   not found          — no listing ever had this id
 *   removed            — one did, and it is gone (the AllowAny status probe
 *                        is the only read that can still say so)
 *
 * On top of that, a listing that IS returned may still not be on sale: the
 * detail endpoint has no `published()` filter, so a draft answers 200 to
 * anyone holding the id. The pane says which side of that it is on rather
 * than dressing a draft up as a shop page.
 */
import type { ReactElement, ReactNode } from "react";
import { Alert, Button, Descriptions, Divider, Flex, Space, Spin, Typography } from "antd";
import { matchLoad, useDescribeFlowError, useT, useI18n } from "@stapel/core";
import { FeatureValueList } from "@stapel/attributes-react/default";
import { formatFeatureValue } from "@stapel/attributes-react";
import { useListingDetail } from "../headless/ListingDetail.js";
import { asFeatureDaoList, featuresDtoFromDaoList } from "../model/features.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { HeartIcon } from "./icons.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { ListingStatusBlock } from "./StatusTags.js";
import { ListingsSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface ListingDetailPaneProps extends ThemeModeProp {
  readonly id: number;
  /** The reader's own uuid, when the host knows it. Enables the owner view —
   * the only place the moderation axis is shown, because it is the only
   * person it concerns. */
  readonly viewerId?: string;
  /** Slots the container fills: "message the seller" (chat-react), the
   * seller's profile link, reviews. Cross-pair navigation is the container's
   * job (spec §6.2 item 5), so this pair takes nodes rather than routes. */
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
}

export function ListingDetailPane(props: ListingDetailPaneProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const bag = useListingDetail(
    props.id,
    props.viewerId !== undefined ? { viewerId: props.viewerId } : {}
  );

  return (
    <ListingsSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Flex vertical gap={16} data-testid="listings-detail">
        {bag.removed ? (
          <Alert
            type="warning"
            showIcon
            data-testid="listings-detail-removed"
            message={t(LISTINGS_I18N_KEYS.detailRemoved)}
          />
        ) : null}

        {matchLoad(bag.state, {
          loading: () => (
            <Flex justify="center" data-testid="listings-detail-loading">
              <Spin aria-label={t(LISTINGS_I18N_KEYS.detailLoading)} />
            </Flex>
          ),
          failed: () =>
            bag.removed ? null : (
              <ErrorAlert
                testId="listings-detail-error"
                error={describe({
                  code: bag.notFound
                    ? LISTINGS_I18N_KEYS.detailNotFound
                    : LISTINGS_I18N_KEYS.detailLoadFailed,
                  params: {},
                  status: 0,
                  message: undefined,
                  language: undefined,
                })}
                action={
                  <Button
                    size="small"
                    data-analytics="none"
                    data-analytics-reason="retrying a read the person already asked for; not a business action"
                    onClick={bag.refetch}
                  >
                    {t(LISTINGS_I18N_KEYS.detailRetry)}
                  </Button>
                }
              />
            ),
          ready: (listing) => (
            <>
              {/* The moderation axis is the OWNER's business and nobody
                  else's: a buyer has no use for "changes under review", and
                  showing a stranger that a listing was refused would leak a
                  verdict about someone else's content. */}
              {bag.viewerIsOwner === true && bag.status !== undefined ? (
                <Flex vertical gap={8} data-testid="listings-detail-owner-view">
                  <ListingStatusBlock status={bag.status} />
                  {!bag.publiclyVisible ? (
                    <Alert
                      type="info"
                      showIcon
                      message={t(LISTINGS_I18N_KEYS.detailOwnerOnlyView)}
                    />
                  ) : null}
                </Flex>
              ) : null}

              {bag.viewerIsOwner !== true && !bag.publiclyVisible ? (
                <Alert
                  type="warning"
                  showIcon
                  data-testid="listings-detail-not-published"
                  message={t(LISTINGS_I18N_KEYS.detailNotPublished)}
                />
              ) : null}

              <Flex gap={16} wrap>
                {bag.images.length === 0 ? (
                  <ListingPhoto
                    imageRef={undefined}
                    alt={listing.title ?? String(listing.id)}
                    style={{ width: 320, aspectRatio: "4 / 3" }}
                  />
                ) : (
                  bag.images.map((ref, index) => (
                    <ListingPhoto
                      key={ref}
                      imageRef={ref}
                      alt={t(LISTINGS_I18N_KEYS.detailPhotoAlt, {
                        index: index + 1,
                        total: bag.images.length,
                      })}
                      style={{ width: 320, aspectRatio: "4 / 3" }}
                    />
                  ))
                )}
              </Flex>

              <Typography.Title level={3} data-testid="listings-detail-title">
                {listing.title ?? ""}
              </Typography.Title>

              {/* The `show_at_title` projection, formatted from the stored
                  DAOs — no category read needed (see model/features.ts). */}
              {bag.titleFeatures.length > 0 ? (
                <Typography.Text type="secondary" data-testid="listings-detail-title-features">
                  {bag.titleFeatures
                    .map((view) =>
                      formatFeatureValue(view.feature, view.value, { t, locale })
                    )
                    .filter((text): text is string => text !== undefined)
                    .join(" · ")}
                </Typography.Text>
              ) : null}

              <Typography.Title level={4} data-testid="listings-detail-price">
                {listing.price !== undefined && listing.price.length > 0
                  ? `${listing.price} ${listing.currency ?? ""}`.trim()
                  : t(LISTINGS_I18N_KEYS.cardPriceAbsent)}
              </Typography.Title>

              <Space wrap>
                <Button
                  disabled={!bag.favoriteGate.available}
                  aria-label={t(
                    bag.isFavorited === true
                      ? LISTINGS_I18N_KEYS.cardFavoriteRemove
                      : LISTINGS_I18N_KEYS.cardFavoriteAdd
                  )}
                  aria-pressed={bag.isFavorited === true}
                  icon={<HeartIcon filled={bag.isFavorited === true} />}
                  data-testid="listings-detail-favorite"
                  data-analytics="none"
                  data-analytics-reason="business action — host app wraps with its own tracked()"
                  onClick={bag.toggleFavorite}
                >
                  {t(
                    bag.isFavorited === true
                      ? LISTINGS_I18N_KEYS.cardFavoriteRemove
                      : LISTINGS_I18N_KEYS.cardFavoriteAdd
                  )}
                </Button>
                {props.actions}
              </Space>

              {/* A switched-off control that cannot say why is the one shape
                  ActionAvailability makes unwritable — so the reason is
                  rendered, not implied by the disabled attribute. */}
              {!bag.favoriteGate.available ? (
                <Typography.Text
                  type="secondary"
                  data-testid="listings-detail-favorite-blocked"
                >
                  {t(
                    bag.favoriteGate.block.code,
                    bag.favoriteGate.block.params
                  )}
                </Typography.Text>
              ) : null}

              <Divider />

              <Typography.Title level={5}>
                {t(LISTINGS_I18N_KEYS.detailDescription)}
              </Typography.Title>
              <Typography.Paragraph data-testid="listings-detail-description">
                {listing.description ?? ""}
              </Typography.Paragraph>

              <Typography.Title level={5}>
                {t(LISTINGS_I18N_KEYS.detailSpecs)}
              </Typography.Title>
              {bag.features.length === 0 ? (
                <Typography.Text type="secondary" data-testid="listings-detail-no-specs">
                  {t(LISTINGS_I18N_KEYS.detailNoSpecs)}
                </Typography.Text>
              ) : (
                <FeatureValueList
                  features={bag.features.map((view) => view.feature)}
                  values={featuresDtoFromDaoList(
                    asFeatureDaoList(listing.features)
                  )}
                />
              )}

              {/* Counted, not rounded to zero: a stored attribute this build
                  cannot key is a gap in what the buyer is being told. */}
              {bag.unreadableFeatures > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  data-testid="listings-detail-unreadable"
                  message={t(LISTINGS_I18N_KEYS.detailUnreadableFeatures, {
                    count: bag.unreadableFeatures,
                  })}
                />
              ) : null}

              <Descriptions size="small" column={1}>
                {/* Label cell and value cell, which is what a `<Descriptions>`
                    row IS: the label key carries no `{count}` (it did, and the
                    page printed the placeholder), the quantity is the value. */}
                {listing.stock_quantity != null ? (
                  <Descriptions.Item label={t(LISTINGS_I18N_KEYS.detailStock)}>
                    <span data-testid="listings-detail-stock">
                      {listing.stock_quantity}
                    </span>
                  </Descriptions.Item>
                ) : null}
                {listing.location_label !== undefined &&
                listing.location_label.length > 0 ? (
                  <Descriptions.Item
                    label={t(LISTINGS_I18N_KEYS.composeLocationLabel)}
                  >
                    {listing.location_label}
                  </Descriptions.Item>
                ) : null}
              </Descriptions>

              {props.footer}
            </>
          ),
        })}
      </Flex>
    </ListingsSkinTheme>
  );
}
