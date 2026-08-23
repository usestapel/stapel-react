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
 */
import type { ReactElement } from "react";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Flex,
  List,
  Space,
  Spin,
  Tabs,
  Tooltip,
  Typography,
} from "antd";
import { matchList, matchLoad, useDescribeFlowError, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { MyListingCard } from "../api/types.js";
import { useMyListings } from "../headless/MyListings.js";
import type { MyListingsSource } from "../model/mineSource.js";
import { useListingActions } from "../headless/ListingActions.js";
import { myListingTitle, showsDraft } from "../model/mine.js";
import { listingStatusView } from "../model/status.js";
import type { MyListingsTab } from "../model/status.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { ListingStatusBlock } from "./StatusTags.js";
import { ListingsSkinTheme } from "./theme.js";
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

/** A control plus the sentence that explains it when it is off. Written once
 * here because this pane has six of them and a grey button with no reason is
 * the one shape `ActionAvailability` exists to make impossible. */
function GatedButton(props: {
  gate: ActionAvailability;
  label: string;
  testId: string;
  onClick: () => void;
  danger?: boolean;
  /** The call sites mark themselves `data-analytics="none"` with a
   * `passthrough` reason (the convention `stapel/clickable-needs-event`
   * documents for a forwarding component); the real click point is the antd
   * button below, which declares its own outcome. */
  "data-analytics"?: string;
  "data-analytics-reason"?: string;
}): ReactElement {
  const t = useT();
  return (
    <Tooltip
      title={
        props.gate.available
          ? props.label
          : t(props.gate.block.code, props.gate.block.params)
      }
    >
      <span>
        <Button
          size="small"
          danger={props.danger === true}
          disabled={!props.gate.available}
          data-testid={props.testId}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
          onClick={props.onClick}
        >
          {props.label}
        </Button>
      </span>
    </Tooltip>
  );
}

function MyListingRow(props: {
  listing: MyListingCard;
  onEdit?: (id: number) => void;
}): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
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

  return (
    <List.Item
      data-testid="listings-mine-row"
      data-listing-id={props.listing.id}
      actions={[
        <GatedButton
          key="edit"
          data-analytics="none"
          data-analytics-reason="passthrough — GatedButton owns the real click point"
          gate={{ available: true }}
          label={t(LISTINGS_I18N_KEYS.mineEdit)}
          testId="listings-mine-edit"
          onClick={() => {
            props.onEdit?.(props.listing.id);
          }}
        />,
        <GatedButton
          key="complete"
          data-analytics="none"
          data-analytics-reason="passthrough — GatedButton owns the real click point"
          gate={actions.complete}
          label={t(LISTINGS_I18N_KEYS.mineComplete)}
          testId="listings-mine-complete"
          onClick={actions.doComplete}
        />,
        <GatedButton
          key="archive"
          data-analytics="none"
          data-analytics-reason="passthrough — GatedButton owns the real click point"
          gate={actions.archive}
          label={t(LISTINGS_I18N_KEYS.mineArchive)}
          testId="listings-mine-archive"
          onClick={actions.doArchive}
        />,
        <GatedButton
          key="delete"
          data-analytics="none"
          data-analytics-reason="passthrough — GatedButton owns the real click point"
          danger
          gate={actions.remove}
          label={t(LISTINGS_I18N_KEYS.mineDelete)}
          testId="listings-mine-delete"
          onClick={actions.doRemove}
        />,
      ]}
    >
      <List.Item.Meta
        title={
          <Space size={6}>
            {heading ?? `#${String(props.listing.id)}`}
            {/* A heading that came off the draft twin is something nobody
                else can read yet. Saying so is the difference between a
                dashboard and a shop window that happens to be yours. */}
            {showsDraft(props.listing) ? (
              <Typography.Text type="secondary" data-testid="listings-mine-draft-title">
                {t(LISTINGS_I18N_KEYS.statusDraft)}
              </Typography.Text>
            ) : null}
          </Space>
        }
        description={
          <Flex vertical gap={4}>
            {status !== undefined ? <ListingStatusBlock status={status} /> : null}
            {actions.error !== undefined && actions.error !== null ? (
              <ErrorAlert
                testId="listings-mine-action-error"
                error={describe({
                  code: LISTINGS_I18N_KEYS.unknownError,
                  params: {},
                  status: 0,
                  message: undefined,
                  language: undefined,
                })}
              />
            ) : null}
          </Flex>
        }
      />
    </List.Item>
  );
}

export interface MyListingsPaneProps extends ThemeModeProp {
  /** How the host gets the caller's own rows. Absent: the contract's own
   * `GET my/listings/`, which is what a storefront wants. */
  readonly source?: MyListingsSource;
  readonly onEdit?: (id: number) => void;
}

export function MyListingsPane(props: MyListingsPaneProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const bag = useMyListings(
    props.source !== undefined ? { source: props.source } : {}
  );

  return (
    <ListingsSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Flex vertical gap={16} data-testid="listings-mine">
        <Typography.Title level={3}>
          {t(LISTINGS_I18N_KEYS.mineTitle)}
        </Typography.Title>

        {!bag.gate.available ? (
          <Alert
            type="info"
            showIcon
            data-testid="listings-mine-blocked"
            message={t(bag.gate.block.code, bag.gate.block.params)}
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
            <Alert
              type="error"
              showIcon
              data-testid="listings-mine-takedowns"
              message={t(LISTINGS_I18N_KEYS.mineBlockedTitle, {
                count: rows.length,
              })}
              description={
                <List
                  dataSource={[...rows]}
                  rowKey={(row) => row.id}
                  renderItem={(row) => (
                    <MyListingRow
                      listing={row}
                      {...(props.onEdit !== undefined
                        ? { onEdit: props.onEdit }
                        : {})}
                    />
                  )}
                />
              }
            />
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
              <Space size={6}>
                {t(TAB_LABEL[tab])}
                {matchLoad(bag.counters, {
                  loading: () => null,
                  // A count we could not fetch is not zero. The badge is
                  // simply absent and the failure is stated once, below.
                  failed: () => null,
                  ready: (counters) => (
                    <Badge
                      count={counters[tab]}
                      showZero
                      data-testid={`listings-mine-count-${tab}`}
                    />
                  ),
                })}
              </Space>
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
            <Flex justify="center" data-testid="listings-mine-loading">
              <Spin aria-label={t(LISTINGS_I18N_KEYS.mineLoading)} />
            </Flex>
          ),
          failed: () => (
            <ErrorAlert
              testId="listings-mine-error"
              error={describe({
                code: LISTINGS_I18N_KEYS.mineLoadFailed,
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
                  {t(LISTINGS_I18N_KEYS.mineRetry)}
                </Button>
              }
            />
          ),
          empty: () => (
            <Empty
              data-testid="listings-mine-empty"
              data-empty-tab={bag.tab}
              description={t(TAB_EMPTY[bag.tab])}
            />
          ),
          ready: (rows) => (
            <List
              dataSource={[...rows]}
              rowKey={(row) => row.id}
              renderItem={(row) => (
                <MyListingRow
                  listing={row}
                  {...(props.onEdit !== undefined ? { onEdit: props.onEdit } : {})}
                />
              )}
            />
          ),
        })}

        <Space>
          <Button
            size="small"
            disabled={!bag.prevPage.available}
            data-testid="listings-mine-prev"
            data-analytics="none"
            data-analytics-reason="paging a list the person is already reading; not a business action"
            onClick={bag.goPrev}
          >
            {t(LISTINGS_I18N_KEYS.pagePrev)}
          </Button>
          <Button
            size="small"
            disabled={!bag.nextPage.available}
            data-testid="listings-mine-next"
            data-analytics="none"
            data-analytics-reason="paging a list the person is already reading; not a business action"
            onClick={bag.goNext}
          >
            {t(LISTINGS_I18N_KEYS.pageNext)}
          </Button>
        </Space>
      </Flex>
    </ListingsSkinTheme>
  );
}
