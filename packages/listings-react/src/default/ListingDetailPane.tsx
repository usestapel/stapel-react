/**
 * `<ListingDetailPane>` — the listing page, and the page a marketplace makes
 * its money on.
 *
 * Five distinct absences, five distinct sentences, and the whole point of the
 * component is that none of them collapses into another:
 *
 *   loading            — we are asking
 *   failed             — we could not ask   (retry, never "nothing here")
 *   not found          — no listing ever had this id
 *   removed            — one did, and it is gone (the AllowAny status probe
 *                        is the only read that can still say so)
 *   withdrawn          — one did, and its owner took it off the shelf: the
 *                        detail 404s while the probe still answers "not
 *                        deleted". NO retry — nothing a retry could change.
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
 *
 * ── The page has a DESKTOP, when the host says so ──────────────────────────
 *
 * Measured on a live classified deployment at 1440×900: the whole listing
 * page was a ~930px single column hugging the start edge, the price a 22px
 * line UNDER the title and smaller than it, and the right half of the screen
 * empty — while the reference design for this page is two columns: gallery +
 * description + specs on the left, a sticky buy column on the right with the
 * price LARGE at its top, then the actions, then the seller block.
 *
 * `layout="split"` is that design. The HOST states the axis — the same rule
 * as CategoryPage's `subcategories`: a decision taken once by the component
 * that knows the viewport it granted, never a media query guessed in a leaf —
 * and the default `"column"` renders exactly what existing hosts already get.
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
  useActionGate,
  useI18n,
  useT,
} from "@stapel/core";
import type { SignInCta } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { FeatureValueList } from "@stapel/attributes-react/default";
import { formatFeatureValue, isRedactedValue } from "@stapel/attributes-react";
import { useListingDetail } from "../headless/ListingDetail.js";
import { useListingActions } from "../headless/ListingActions.js";
import { asFeatureDaoList, featureValuesForDisplay } from "../model/features.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { GateReasonPopover } from "./GateReasonPopover.js";
import { SignInLink } from "./SignInLink.js";
import { HeartIcon } from "./icons.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { ListingPrice } from "./ListingPrice.js";
import { ListingStatusBlock } from "./StatusTags.js";
import type { CategoryFeaturesProp, ThemeModeProp } from "./types.js";

/** The reading measure of the page body. A detail page is prose plus a spec
 * table; past this it stops being one column and starts being a stripe across
 * a 2560px pane. */
export const DETAIL_MEASURE = "60rem";

/**
 * The split layout's measure. {@link DETAIL_MEASURE} is a ONE-COLUMN reading
 * measure; in the split the same prose shares the row with a fixed buy
 * column and a gap, so the pane must be wider for the reading half to keep
 * its line — 75rem puts the left column back at roughly the width the
 * one-column page reads at, with the buy column beside it instead of the
 * empty half-screen the 1440×900 walk measured.
 */
export const DETAIL_SPLIT_MEASURE = "75rem";

/**
 * The buy column's fixed track. A width, not a fraction: a price, a row of
 * buttons and a seller block do not improve with width, and every pixel they
 * took would come out of the reading column — so the reading column is the
 * `1fr` and this is not.
 */
export const DETAIL_SPLIT_ASIDE = "380px";

/** The narrowest a gallery tile may get before the grid drops a column. A
 * measure rather than a pixel: the tiles then fill whatever the ELEMENT is,
 * which is §83's geometry rule — one photo per row on a phone, three on a
 * desktop pane, and no `width: 320` that is near-full-bleed on one and a
 * postage stamp on the other. */
export const DETAIL_PHOTO_MIN = "14rem";

export interface ListingDetailPaneProps
  extends ThemeModeProp,
    CategoryFeaturesProp {
  readonly id: number;
  /** The reader's own uuid, when the host knows it. Enables the owner view —
   * the only place the moderation axis is shown, because it is the only
   * person it concerns. */
  readonly viewerId?: string;
  /**
   * Which desktop the page renders: the single reading column it has always
   * been (default `"column"`, byte-compatible for existing hosts), or the
   * reference design's two-column split — see this file's header for the
   * measurement that earned it. The host states the axis; the pane never
   * reads the viewport.
   */
  readonly layout?: "column" | "split";
  /**
   * The host's seller block (a profile card, ratings, "member since" — a
   * different pair's data, so it arrives as a node). In `"split"` it renders
   * inside the sticky buy column, under the actions, where the reference
   * design keeps it. In `"column"` there is no buy column to live in, so it
   * joins the end of the reading flow directly ABOVE `footer` — the flow
   * position the footer already holds, so a host passing both gets seller
   * block then footer, in that order.
   */
  readonly aside?: ReactNode;
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
  /**
   * The container's sign-in door, rendered beside the favourite's refusal —
   * the same `SignInCta` seam the three card skins already take. The pane was
   * the one heart in this pair whose "sign in to do this" had no door next to
   * it (measured on a live storefront: the sentence, and the nearest sign-in
   * a screen-corner away), which is exactly the gap `signIn` closed on the
   * cards. Absent: the reason stands alone, as before.
   */
  readonly signIn?: SignInCta;
  /**
   * How the favourite's blocked reason speaks: `"text"` (default) keeps the
   * standing sentence + door beside the heart; `"popover"` moves both into a
   * disclosure on the heart itself — the cards' third arm, same argument and
   * same accessibility floor (see `ListingCardBlockedReason`), for a host
   * whose chrome already carries a standing sign-in door.
   */
  readonly blockedReason?: "text" | "popover";
  readonly footer?: ReactNode;
}

export function ListingDetailPane(props: ListingDetailPaneProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const bag = useListingDetail(props.id, {
    ...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {}),
    ...(props.categoryFeatures !== undefined
      ? { categoryFeatures: props.categoryFeatures }
      : {}),
  });
  const owner = bag.viewerIsOwner === true;
  const actions = useListingActions(props.id, bag.status?.lifecycle.status);
  const editGate = actions.editGate(props.onEdit !== undefined);
  // The gate VIEW (localized reason), for the popover arm — the "text" arm
  // leaves rendering the reason to `<GatedControl>`, which computes its own.
  const favoriteView = useActionGate(bag.favoriteGate);
  const split = props.layout === "split";

  const favoriteLabel = t(
    bag.isFavorited === true
      ? LISTINGS_I18N_KEYS.cardFavoriteRemove
      : LISTINGS_I18N_KEYS.cardFavoriteAdd
  );

  return (
    <SkinTheme
      surface="base"
      style={{
        maxWidth: split ? DETAIL_SPLIT_MEASURE : DETAIL_MEASURE,
        padding: spacing[4],
      }}
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
          // The failed arm, most specific sentence first: removed (the banner
          // above already says it) → not found → withdrawn → the generic
          // retry. `withdrawn` carries no retry control on purpose — the row
          // is gone by its owner's choice, and a retry that can never help is
          // what this arm replaces.
          failed: (error) =>
            bag.removed ? null : bag.notFound ? (
              <EmptyState
                testId="listings-detail-error"
                title={t(LISTINGS_I18N_KEYS.detailNotFound)}
              />
            ) : bag.withdrawn ? (
              <EmptyState
                testId="listings-detail-withdrawn"
                title={t(LISTINGS_I18N_KEYS.detailWithdrawn)}
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
          ready: (listing) => {
            /* The moderation axis is the OWNER's business and nobody
               else's: a buyer has no use for "changes under review", and
               showing a stranger that a listing was refused would leak a
               verdict about someone else's content. Rendered above the
               split, full width — a verdict is about the PAGE, not about
               either of its columns. */
            const statusBlocks = (
              <>
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
              </>
            );

            /* Element-width tiles: the grid decides how many fit, the
               photos fill them. */
            const gallery = (
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
            );

            const heading = (
              <>
                <Typography.Title level={3} data-testid="listings-detail-title">
                  {listing.title ?? ""}
                </Typography.Title>

                {/* The `show_at_title` projection, formatted from the stored
                    DAOs — no category read needed (see model/features.ts). */}
                {bag.titleFeatures.length > 0 ? (
                  <Typography.Text type="secondary" data-testid="listings-detail-title-features">
                    {bag.titleFeatures
                      // A hidden value is never part of a title: the server
                      // keeps one out of `features_title` entirely, and
                      // `formatFeatureValue` refuses a stub besides (it carries
                      // no value, so there is nothing to format). The filter is
                      // the third belt, and it is here rather than at the
                      // formatter's edge because THIS is the line where a
                      // leaked identifier would be read out loud.
                      .filter((view) => !isRedactedValue(view.value))
                      .map((view) =>
                        formatFeatureValue(view.feature, view.value, { t, locale })
                      )
                      .filter((text): text is string => text !== undefined)
                      .join(" · ")}
                  </Typography.Text>
                ) : null}
              </>
            );

            /* In the split the price leads the buy column at level 2 — the
               measured page had it at 22px UNDER the title, smaller than the
               thing it prices, which is backwards on the one line a buyer
               came to read. In the column it stays the level-4 line it has
               always been. */
            const price = (
              <Typography.Title
                level={split ? 2 : 4}
                data-testid="listings-detail-price"
              >
                <ListingPrice
                  amount={listing.price}
                  {...(listing.currency !== undefined
                    ? { currency: listing.currency }
                    : {})}
                />
              </Typography.Title>
            );

            /* The buy box. One primary, and which one depends on who is
               reading this page. */
            const buyBox = (
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
                {owner ? null : props.blockedReason === "popover" &&
                  favoriteView.reason !== undefined ? (
                  /* The cards' third volume, verbatim: nothing standing, the
                     reason and the door disclosed on the heart. `aria-disabled`
                     rather than `disabled`, so the disclosure's hover, focus
                     and tap all arrive — and the click is a safe no-op, because
                     `toggleFavorite` refuses while the gate is blocked. */
                  <GateReasonPopover
                    reason={favoriteView.reason}
                    cta={props.signIn}
                    testId="listings-detail-favorite-reason"
                    signInTestId="listings-detail-sign-in"
                  >
                    {(bind) => (
                      <Button
                        aria-disabled
                        {...bind}
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
                  </GateReasonPopover>
                ) : (
                  <Flex vertical gap={spacing[1]}>
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
                    {/* The door. `GatedControl` prints the reason; where a
                        visitor signs in is the container's, and arrives as
                        `signIn` — the cards' own pattern, verbatim. */}
                    {bag.favoriteGate.available ? null : (
                      <Typography.Text
                        type="secondary"
                        data-testid="listings-detail-favorite-blocked"
                      >
                        <SignInLink cta={props.signIn} testId="listings-detail-sign-in" />
                      </Typography.Text>
                    )}
                  </Flex>
                )}

                {props.actions}
              </Flex>
            );

            const actionError =
              actions.error !== undefined && actions.error !== null ? (
                <ErrorAlert
                  testId="listings-detail-action-error"
                  thrown={actions.error}
                  variant="inline"
                />
              ) : null;

            const description = (
              <>
                <Typography.Title level={5}>
                  {t(LISTINGS_I18N_KEYS.detailDescription)}
                </Typography.Title>
                <Typography.Paragraph data-testid="listings-detail-description">
                  {listing.description ?? ""}
                </Typography.Paragraph>
              </>
            );

            /* The DISPLAY envelope, not the edit one: a redacted row keeps
               its place in the table and says the seller supplied the value.
               `featuresDtoFromDaoList` deliberately drops a stub, because it
               is what seeds a composer. */
            const specValues = featureValuesForDisplay(
              asFeatureDaoList(listing.features),
              props.categoryFeatures !== undefined
                ? { categoryFeatures: props.categoryFeatures }
                : {}
            );
            /* Two spec columns in the split, split by ROW COUNT and not by
               `<FeatureValueList>` — the halves are cut HERE so the category's
               declaration order survives: the first (larger) half fills the
               left list, and the table reads top-to-bottom, left column
               first, exactly as the one-column table read. */
            const specHalf = Math.ceil(bag.features.length / 2);
            const specs =
              bag.features.length === 0 ? (
                <Typography.Text type="secondary" data-testid="listings-detail-no-specs">
                  {t(LISTINGS_I18N_KEYS.detailNoSpecs)}
                </Typography.Text>
              ) : split ? (
                <div
                  data-testid="listings-detail-specs-split"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: spacing[4],
                    alignItems: "start",
                  }}
                >
                  <FeatureValueList
                    features={bag.features
                      .slice(0, specHalf)
                      .map((view) => view.feature)}
                    values={specValues}
                  />
                  {bag.features.length > specHalf ? (
                    <FeatureValueList
                      features={bag.features
                        .slice(specHalf)
                        .map((view) => view.feature)}
                      values={specValues}
                    />
                  ) : null}
                </div>
              ) : (
                <FeatureValueList
                  features={bag.features.map((view) => view.feature)}
                  values={specValues}
                />
              );

            const specsSection = (
              <>
                <Typography.Title level={5}>
                  {t(LISTINGS_I18N_KEYS.detailSpecs)}
                </Typography.Title>
                {specs}

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
              </>
            );

            const meta = (
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
            );

            const aside =
              props.aside !== undefined ? (
                <div data-testid="listings-detail-aside">{props.aside}</div>
              ) : null;

            if (!split) {
              // The single column, in the order it has always read — the
              // host's aside joins where the footer's flow already is.
              return (
                <>
                  {statusBlocks}
                  {gallery}
                  {heading}
                  {price}
                  {buyBox}
                  {actionError}
                  <Divider />
                  {description}
                  {specsSection}
                  {meta}
                  {aside}
                  {props.footer}
                </>
              );
            }

            return (
              <>
                {statusBlocks}
                <div
                  data-testid="listings-detail-split"
                  style={{
                    display: "grid",
                    // The reading column takes what is left and may shrink
                    // (`minmax(0, …)`, or a long unbroken title widens the
                    // track past the pane); the buy column's track is fixed —
                    // see DETAIL_SPLIT_ASIDE for why it is not a fraction.
                    gridTemplateColumns: `minmax(0, 1fr) ${DETAIL_SPLIT_ASIDE}`,
                    gap: spacing[5],
                    alignItems: "start",
                  }}
                >
                  <Flex vertical gap={spacing[4]}>
                    {gallery}
                    {heading}
                    <Divider />
                    {description}
                    {specsSection}
                    {meta}
                    {props.footer}
                  </Flex>
                  {/* Sticky, so the actions ride along a page whose left
                      column is as tall as the seller's photo set. `alignSelf:
                      "start"` is load-bearing: a grid item stretches to the
                      row's height by default, and an element as tall as its
                      scroll container has nowhere to stick. */}
                  <Flex
                    vertical
                    gap={spacing[3]}
                    data-testid="listings-detail-buy-column"
                    style={{
                      position: "sticky",
                      top: spacing[4],
                      alignSelf: "start",
                    }}
                  >
                    {price}
                    {buyBox}
                    {actionError}
                    {aside}
                  </Flex>
                </div>
              </>
            );
          },
        })}
      </Flex>
    </SkinTheme>
  );
}
