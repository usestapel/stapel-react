/**
 * `<ListingDetailPane>` — the listing page, and the page a marketplace makes
 * its money on.
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
 *
 * ── The page has ONE primary action, and it depends on who is reading ──────
 *
 * For two releases the only control here was "Save to favourites" — the money
 * screen of a marketplace with no way to reach the seller, and the owner's own
 * copy of the page offering to favourite their own listing. So:
 *
 *   a buyer  → `contactSlot` (the container's `@stapel/chat-react`
 *              "message the seller" button), with favouriting beside it as
 *              the secondary it always was;
 *   the owner → Edit and Take down, and no contact button at all — you do not
 *              message yourself.
 *
 * `contactSlot` is a SLOT because conversations belong to another L2 pair and
 * L2 pairs do not import each other. Unfilled it renders `<SlotPlaceholder>`,
 * so an app wired without a chat is a named gap in a dev build rather than a
 * page whose only verb is "save".
 */
import type { ReactElement, ReactNode } from "react";
import { Button, Descriptions, Divider, Flex, Typography } from "antd";
import {
  ErrorAlert,
  EmptyState,
  GatedButton,
  GatedControl,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  SlotPlaceholder,
  matchLoad,
  useI18n,
  useT,
} from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { FeatureValueList } from "@stapel/attributes-react/default";
import { formatFeatureValue } from "@stapel/attributes-react";
import { useListingDetail } from "../headless/ListingDetail.js";
import { useListingActions } from "../headless/ListingActions.js";
import { asFeatureDaoList, featuresDtoFromDaoList } from "../model/features.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { HeartIcon } from "./icons.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { ListingPrice } from "./ListingPrice.js";
import { ListingStatusBlock } from "./StatusTags.js";
import type { ThemeModeProp } from "./types.js";

/** The reading measure of the page body. A detail page is prose plus a spec
 * table; past this it stops being one column and starts being a stripe across
 * a 2560px pane. */
export const DETAIL_MEASURE = "60rem";

/** The narrowest a gallery tile may get before the grid drops a column. A
 * measure rather than a pixel: the tiles then fill whatever the ELEMENT is,
 * which is §83's geometry rule — one photo per row on a phone, three on a
 * desktop pane, and no `width: 320` that is near-full-bleed on one and a
 * postage stamp on the other. */
export const DETAIL_PHOTO_MIN = "14rem";

export interface ListingDetailPaneProps extends ThemeModeProp {
  readonly id: number;
  /** The reader's own uuid, when the host knows it. Enables the owner view —
   * the only place the moderation axis is shown, because it is the only
   * person it concerns. */
  readonly viewerId?: string;
  /**
   * THE primary action for a buyer: "message the seller", filled by the
   * container from `@stapel/chat-react`. Rendered first, before favouriting,
   * and never shown to the owner.
   */
  readonly contactSlot?: ReactNode;
  /** Open the composer on this listing — the owner's primary. Absent is a real
   * answer: the button then states that this app has no editing screen. */
  readonly onEdit?: (id: number) => void;
  /** Extra chrome beside the primary (the seller's profile link, a share
   * button). Cross-pair navigation is the container's job (spec §6.2 item 5),
   * so this pair takes nodes rather than routes. */
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
}

export function ListingDetailPane(props: ListingDetailPaneProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const bag = useListingDetail(
    props.id,
    props.viewerId !== undefined ? { viewerId: props.viewerId } : {}
  );
  const owner = bag.viewerIsOwner === true;
  const actions = useListingActions(props.id, bag.status?.lifecycle.status);
  const editGate = actions.editGate(props.onEdit !== undefined);

  const favoriteLabel = t(
    bag.isFavorited === true
      ? LISTINGS_I18N_KEYS.cardFavoriteRemove
      : LISTINGS_I18N_KEYS.cardFavoriteAdd
  );

  return (
    <SkinTheme
      surface="base"
      style={{ maxWidth: DETAIL_MEASURE, padding: spacing[4] }}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={spacing[4]} data-testid="listings-detail">
        {bag.removed ? (
          <ErrorAlert
            testId="listings-detail-removed"
            message={t(LISTINGS_I18N_KEYS.detailRemoved)}
          />
        ) : null}

        {matchLoad(bag.state, {
          loading: () => (
            <div
              role="status"
              aria-busy="true"
              aria-label={t(LISTINGS_I18N_KEYS.detailLoading)}
              data-testid="listings-detail-loading"
              data-stapel-load-state="loading"
            />
          ),
          failed: (error) =>
            bag.removed ? null : bag.notFound ? (
              <EmptyState
                testId="listings-detail-error"
                title={t(LISTINGS_I18N_KEYS.detailNotFound)}
              />
            ) : (
              <ErrorAlert
                testId="listings-detail-error"
                thrown={error}
                message={t(LISTINGS_I18N_KEYS.detailLoadFailed)}
                onRetry={bag.refetch}
                retryLabel={t(LISTINGS_I18N_KEYS.detailRetry)}
              />
            ),
          ready: (listing) => (
            <>
              {/* The moderation axis is the OWNER's business and nobody
                  else's: a buyer has no use for "changes under review", and
                  showing a stranger that a listing was refused would leak a
                  verdict about someone else's content. */}
              {owner && bag.status !== undefined ? (
                <Flex vertical gap={spacing[2]} data-testid="listings-detail-owner-view">
                  <ListingStatusBlock status={bag.status} />
                  {!bag.publiclyVisible ? (
                    <Typography.Text type="secondary">
                      {t(LISTINGS_I18N_KEYS.detailOwnerOnlyView)}
                    </Typography.Text>
                  ) : null}
                </Flex>
              ) : null}

              {!owner && !bag.publiclyVisible ? (
                <ErrorAlert
                  testId="listings-detail-not-published"
                  message={t(LISTINGS_I18N_KEYS.detailNotPublished)}
                  variant="inline"
                />
              ) : null}

              {/* Element-width tiles: the grid decides how many fit, the
                  photos fill them. */}
              <div
                data-testid="listings-detail-gallery"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(auto-fit, minmax(${DETAIL_PHOTO_MIN}, 1fr))`,
                  gap: spacing[3],
                }}
              >
                {bag.images.length === 0 ? (
                  <ListingPhoto
                    imageRef={undefined}
                    alt={listing.title ?? String(listing.id)}
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
                    />
                  ))
                )}
              </div>

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
                <ListingPrice
                  amount={listing.price}
                  {...(listing.currency !== undefined
                    ? { currency: listing.currency }
                    : {})}
                />
              </Typography.Title>

              {/* The buy box. One primary, and which one depends on who is
                  reading this page. */}
              <Flex
                wrap
                gap={spacing[3]}
                align="flex-start"
                data-testid="listings-detail-actions"
              >
                {owner ? (
                  <>
                    <GatedButton
                      gate={editGate}
                      type="primary"
                      testId="listings-detail-edit"
                      data-analytics="none"
                      data-analytics-reason="business action — host app wraps with its own tracked()"
                      onClick={() => {
                        props.onEdit?.(props.id);
                      }}
                    >
                      {t(LISTINGS_I18N_KEYS.detailEdit)}
                    </GatedButton>
                    <GatedButton
                      gate={actions.archive}
                      danger
                      testId="listings-detail-take-down"
                      data-analytics="none"
                      data-analytics-reason="business action — host app wraps with its own tracked()"
                      onClick={actions.doArchive}
                    >
                      {t(LISTINGS_I18N_KEYS.detailTakeDown)}
                    </GatedButton>
                  </>
                ) : (
                  <div data-testid="listings-detail-contact">
                    {props.contactSlot ?? <SlotPlaceholder name="contactSlot" />}
                  </div>
                )}

                {/* Favouriting your own listing is not a thing anyone does;
                    for everyone else it is the secondary it always was. */}
                {owner ? null : (
                  <GatedControl
                    gate={bag.favoriteGate}
                    testId="listings-detail-favorite-gate"
                  >
                    {(bind) => (
                      <Button
                        disabled={bind.disabled}
                        data-disabled-reason="the enclosing <GatedControl> renders the gate's reason beside this button"
                        {...(bind["aria-describedby"] !== undefined
                          ? { "aria-describedby": bind["aria-describedby"] }
                          : {})}
                        aria-label={favoriteLabel}
                        aria-pressed={bag.isFavorited === true}
                        icon={<HeartIcon filled={bag.isFavorited === true} />}
                        data-testid="listings-detail-favorite"
                        data-analytics="none"
                        data-analytics-reason="business action — host app wraps with its own tracked()"
                        onClick={bag.toggleFavorite}
                      >
                        {favoriteLabel}
                      </Button>
                    )}
                  </GatedControl>
                )}

                {props.actions}
              </Flex>

              {actions.error !== undefined && actions.error !== null ? (
                <ErrorAlert
                  testId="listings-detail-action-error"
                  thrown={actions.error}
                  variant="inline"
                />
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
                <Typography.Text
                  type="warning"
                  data-testid="listings-detail-unreadable"
                >
                  {t(LISTINGS_I18N_KEYS.detailUnreadableFeatures, {
                    count: bag.unreadableFeatures,
                  })}
                </Typography.Text>
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
    </SkinTheme>
  );
}
