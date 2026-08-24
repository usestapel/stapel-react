/**
 * `<MyListingsPane>` — the seller's dashboard.
 *
 * Three counts and the rows behind them, both real since stapel-listings
 * 0.7.0 gave the owner's own listings a route (`GET my/listings/`). Until
 * then this pane showed the counts and NAMED the missing endpoint where the
 * rows should be; `model/mineSource.ts` keeps that history and the seam it
 * left behind.
 *
 * Three things this pane refuses to smooth over:
 *
 * 1. **Both axes on every row.** "Published" and "changes under review" appear
 *    beside each other, which is the entire reason `model/status.ts` exists: a
 *    dashboard that derived one from the other would tell a seller their live
 *    listing is offline, or never tell them their edit is being screened.
 *    `moderation_status` is on the owner card, so the row reads the real
 *    value rather than the `"approved"` stand-in it used before 0.7.0.
 * 2. **Takedowns are not in a tab.** The three tabs are the SERVER's status
 *    groupings and `blocked` is in none of them, because `my/counters` counts
 *    it in none of them. Folding it into one would make a tab's rows and its
 *    badge describe different sets; leaving it out entirely would hide the
 *    one listing whose owner most needs to know. So it sits above the tabs,
 *    where it cannot be missed.
 * 3. **An empty tab says which emptiness it is.** "No drafts" and "nothing
 *    sold yet" are different sentences and one generic "nothing here" is
 *    neither.
 *
 * ── The row, rebuilt for a 390px screen ────────────────────────────────────
 *
 * The visual pass measured the old one and it failed on a phone in four ways
 * at once: `Edit ¦ Mark sold ¦ Archive ¦ Delete` in antd's `List.Item`
 * `actions` slot overflowed the viewport and clipped "Delete"; the title and
 * the status shared one line with no `min-width: 0`, so the word "Draft" split
 * into "Draf/t"; the status itself was drawn three different ways down one
 * list; and every "why is this off" sentence lived in a `Tooltip`, which a
 * touch device cannot open and a disabled antd button never fires anyway.
 *
 * So: the row is a two-column flex (thumbnail, then a `min-width: 0` column
 * that owns the title, the status and the actions), the actions WRAP instead
 * of overflowing, each one is a shared `<GatedButton>` with its reason as
 * ordinary text beside it, and the status is one `<ListingStatusBlock>`.
 * Delete asks first, through the shared `<SkinConfirm>` — a bottom sheet on a
 * phone. It used to fire the mutation on the first click.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, List, Tabs, Typography } from "antd";
import {
  ErrorAlert,
  EmptyState,
  GatedButton,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { matchList, matchLoad, useT } from "@stapel/core";
import type { SignInCtaProp } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { MyListingCard } from "../api/types.js";
import { useMyListings } from "../headless/MyListings.js";
import type { MyListingsSource } from "../model/mineSource.js";
import { useListingActions } from "../headless/ListingActions.js";
import { myListingTitle } from "../model/mine.js";
import { listingStatusView } from "../model/status.js";
import type { MyListingsTab } from "../model/status.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { SignInLink } from "./SignInLink.js";
import { ListingStatusBlock } from "./StatusTags.js";
import type { ThemeModeProp } from "./types.js";

const TAB_LABEL: Readonly<Record<MyListingsTab, string>> = {
  active: LISTINGS_I18N_KEYS.mineTabActive,
  drafts: LISTINGS_I18N_KEYS.mineTabDrafts,
  archived: LISTINGS_I18N_KEYS.mineTabArchived,
};

/** One empty sentence per tab — see the header, point 3. */
const TAB_EMPTY: Readonly<Record<MyListingsTab, string>> = {
  active: LISTINGS_I18N_KEYS.mineEmptyActive,
  drafts: LISTINGS_I18N_KEYS.mineEmptyDrafts,
  archived: LISTINGS_I18N_KEYS.mineEmptyArchived,
};

/** The thumbnail column. A photo marketplace whose seller dashboard is a
 * column of text is missing the one thing that identifies a row at a glance;
 * a fixed measure because the column must not reflow per row. */
const THUMB_WIDTH = "4.5rem";

function MyListingRow(props: {
  listing: MyListingCard;
  onEdit?: ((id: number) => void) | undefined;
  onAskRemove: (id: number) => void;
}): ReactElement {
  const t = useT();
  const actions = useListingActions(props.listing.id, props.listing.status);
  // Both axes, both real: `MyListingCardSerializer` puts `moderation_status`
  // on the owner's card, so the row no longer has to pass "approved" as a
  // stand-in and lose the one combination that matters — a LIVE listing whose
  // edit is under review.
  const status =
    props.listing.status === undefined
      ? undefined
      : listingStatusView(
          props.listing.status,
          props.listing.moderation_status ?? "approved"
        );
  const heading = myListingTitle(props.listing);
  const onEdit = props.onEdit;
  // A control that offers something meaningless in the current state is the
  // one shape §83 forbids: with no `onEdit` — which is exactly how the
  // scripted scaffold mounts this pane — the button used to be enabled,
  // clickable and inert. It is now switched off WITH the reason.
  const editGate = actions.editGate(onEdit !== undefined);
  const cover = props.listing.images?.[0] ?? props.listing.images_draft?.[0];

  return (
    <List.Item
      data-testid="listings-mine-row"
      data-listing-id={props.listing.id}
      style={{ alignItems: "flex-start" }}
    >
      <Flex gap={spacing[3]} style={{ width: "100%", minWidth: 0 }}>
        <div style={{ flex: `0 0 ${THUMB_WIDTH}`, width: THUMB_WIDTH }}>
          <ListingPhoto
            imageRef={cover}
            alt={heading ?? `#${String(props.listing.id)}`}
          />
        </div>

        {/* `min-width: 0` is what stops a long title from pushing the status
            out of the row and splitting a word across two lines. */}
        <Flex vertical gap={spacing[2]} style={{ flex: "1 1 auto", minWidth: 0 }}>
          <Typography.Text strong ellipsis data-testid="listings-mine-title">
            {heading ?? `#${String(props.listing.id)}`}
          </Typography.Text>

          {/* ONE status treatment. The word "Draft" beside the title was a
              second, redundant rendering of what this tag already says. */}
          {status !== undefined ? <ListingStatusBlock status={status} /> : null}

          {actions.error !== undefined && actions.error !== null ? (
            <ErrorAlert
              testId="listings-mine-action-error"
              thrown={actions.error}
              variant="inline"
            />
          ) : null}

          {/* Wrap, never overflow: four actions do not fit across 390px and a
              clipped "Delete" is a control that is not there. */}
          <Flex wrap gap={spacing[2]} align="flex-start">
            <GatedButton
              gate={editGate}
              size="small"
              testId="listings-mine-edit"
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked()"
              onClick={() => {
                onEdit?.(props.listing.id);
              }}
            >
              {t(LISTINGS_I18N_KEYS.mineEdit)}
            </GatedButton>
            <GatedButton
              gate={actions.complete}
              size="small"
              testId="listings-mine-complete"
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked()"
              onClick={actions.doComplete}
            >
              {t(LISTINGS_I18N_KEYS.mineComplete)}
            </GatedButton>
            <GatedButton
              gate={actions.archive}
              size="small"
              testId="listings-mine-archive"
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked()"
              onClick={actions.doArchive}
            >
              {t(LISTINGS_I18N_KEYS.mineArchive)}
            </GatedButton>
            <GatedButton
              gate={actions.remove}
              size="small"
              danger
              testId="listings-mine-delete"
              data-analytics="none"
              data-analytics-reason="opens the delete confirmation"
              onClick={() => {
                props.onAskRemove(props.listing.id);
              }}
            >
              {t(LISTINGS_I18N_KEYS.mineDelete)}
            </GatedButton>
          </Flex>
        </Flex>
      </Flex>
    </List.Item>
  );
}

export interface MyListingsPaneProps extends ThemeModeProp, SignInCtaProp {
  /** How the host gets the caller's own rows. Absent: the contract's own
   * `GET my/listings/`, which is what a storefront wants. */
  readonly source?: MyListingsSource;
  /**
   * Open the composer on one of these listings. ABSENT IS A REAL ANSWER: the
   * Edit button then states that this app has no editing screen instead of
   * offering a click that does nothing.
   */
  readonly onEdit?: (id: number) => void;
}

export function MyListingsPane(props: MyListingsPaneProps): ReactElement {
  const t = useT();
  const bag = useMyListings(
    props.source !== undefined ? { source: props.source } : {}
  );
  // ONE confirmation for the whole list, keyed by the row that asked — not one
  // mounted dialog per row.
  const [removingId, setRemovingId] = useState<number | null>(null);
  const removal = useListingActions(
    removingId ?? 0,
    bag.rows.status === "ready"
      ? bag.rows.data.find((row) => row.id === removingId)?.status
      : undefined
  );

  const paged = bag.prevPage.available || bag.nextPage.available;

  const renderRow = (row: MyListingCard): ReactElement => (
    <MyListingRow
      listing={row}
      onEdit={props.onEdit}
      onAskRemove={setRemovingId}
    />
  );

  return (
    <SkinTheme
      surface="base"
      style={{ padding: spacing[4] }}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={spacing[4]} data-testid="listings-mine">
        <Typography.Title level={3}>
          {t(LISTINGS_I18N_KEYS.mineTitle)}
        </Typography.Title>

        {!bag.gate.available ? (
          <EmptyState
            testId="listings-mine-blocked"
            title={t(bag.gate.block.code, bag.gate.block.params)}
            action={
              <SignInLink cta={props.signIn} testId="listings-mine-sign-in" />
            }
          />
        ) : null}

        {/* The rows no tab folds in — see the header, point 2. Rendered
            only when there are some: an empty takedown section is a scare,
            and a failure to CHECK is not the same as "none", so it says so. */}
        {matchList(bag.blockedRows, {
          loading: () => null,
          failed: () => (
            <Typography.Text
              type="secondary"
              data-testid="listings-mine-takedowns-failed"
            >
              {t(LISTINGS_I18N_KEYS.mineBlockedLoadFailed)}
            </Typography.Text>
          ),
          empty: () => null,
          ready: (rows) => (
            <Flex vertical gap={spacing[2]} data-testid="listings-mine-takedowns">
              <Typography.Text type="warning" strong>
                {t(LISTINGS_I18N_KEYS.mineBlockedTitle, { count: rows.length })}
              </Typography.Text>
              <List
                dataSource={[...rows]}
                rowKey={(row) => row.id}
                renderItem={renderRow}
              />
            </Flex>
          ),
        })}

        <Tabs
          activeKey={bag.tab}
          data-testid="listings-mine-tabs"
          onChange={(key) => {
            bag.setTab(key as MyListingsTab);
          }}
          items={bag.tabs.map((tab) => ({
            key: tab,
            label: (
              <>
                {t(TAB_LABEL[tab])}
                {matchLoad(bag.counters, {
                  loading: () => null,
                  // A count we could not fetch is not zero. The number is
                  // simply absent and the failure is stated once, below.
                  failed: () => null,
                  // A plain secondary number, not a red antd Badge: red is the
                  // danger token and "Active 2" is not a warning. It also
                  // keeps the tab short enough that three of them fit on a
                  // phone instead of collapsing into an overflow menu.
                  ready: (counters) => (
                    <Typography.Text
                      type="secondary"
                      data-testid={`listings-mine-count-${tab}`}
                    >
                      {` ${String(counters[tab])}`}
                    </Typography.Text>
                  ),
                })}
              </>
            ),
          }))}
        />

        {matchLoad(bag.counters, {
          loading: () => null,
          failed: () => (
            <Typography.Text type="secondary" data-testid="listings-mine-counters-failed">
              {t(LISTINGS_I18N_KEYS.mineCountersFailed)}
            </Typography.Text>
          ),
          ready: () => null,
        })}

        {matchList(bag.rows, {
          loading: () => (
            <div
              role="status"
              aria-busy="true"
              aria-label={t(LISTINGS_I18N_KEYS.mineLoading)}
              data-testid="listings-mine-loading"
              data-stapel-load-state="loading"
            />
          ),
          failed: (error) => (
            <ErrorAlert
              testId="listings-mine-error"
              thrown={error}
              message={t(LISTINGS_I18N_KEYS.mineLoadFailed)}
              onRetry={bag.refetch}
              retryLabel={t(LISTINGS_I18N_KEYS.mineRetry)}
            />
          ),
          empty: () => (
            // The tab is stamped on the wrapper, not only spoken in the copy:
            // "no drafts" and "nothing sold yet" are different emptinesses and
            // a test has to be able to tell which one is on screen.
            <div data-testid="listings-mine-empty" data-empty-tab={bag.tab}>
              <EmptyState title={t(TAB_EMPTY[bag.tab])} />
            </div>
          ),
          ready: (rows) => (
            <List
              dataSource={[...rows]}
              rowKey={(row) => row.id}
              renderItem={renderRow}
            />
          ),
        })}

        {/* A pager over a list with one page is two controls that mean
            nothing. It renders when there is somewhere to go, and not
            before. */}
        {paged ? (
          <Flex gap={spacing[2]} wrap>
            <GatedButton
              gate={bag.prevPage}
              size="small"
              layout="inline"
              testId="listings-mine-prev"
              data-analytics="none"
              data-analytics-reason="paging a list the person is already reading; not a business action"
              onClick={bag.goPrev}
            >
              {t(LISTINGS_I18N_KEYS.pagePrev)}
            </GatedButton>
            <GatedButton
              gate={bag.nextPage}
              size="small"
              layout="inline"
              testId="listings-mine-next"
              data-analytics="none"
              data-analytics-reason="paging a list the person is already reading; not a business action"
              onClick={bag.goNext}
            >
              {t(LISTINGS_I18N_KEYS.pageNext)}
            </GatedButton>
          </Flex>
        ) : null}

        <SkinConfirm
          open={removingId !== null}
          danger
          title={t(LISTINGS_I18N_KEYS.mineDeleteConfirmTitle)}
          body={t(LISTINGS_I18N_KEYS.mineDeleteConfirmBody)}
          confirmLabel={t(LISTINGS_I18N_KEYS.mineDelete)}
          confirming={removal.inFlight}
          data-testid="listings-mine-delete-confirm"
          onConfirm={() => {
            removal.doRemove();
            setRemovingId(null);
          }}
          onCancel={() => {
            setRemovingId(null);
          }}
        />
      </Flex>
    </SkinTheme>
  );
}
