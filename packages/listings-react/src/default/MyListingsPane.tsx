/**
 * `<MyListingsPane>` — the seller's dashboard.
 *
 * Three counts that are real, and rows that may not be: stapel-listings 0.6.1
 * has no owner-scoped list endpoint (`headless/MyListings.tsx` argues it in
 * full), so the rows come from an injected source and the pane NAMES the gap
 * when there is none. The counters are shown either way, because they are the
 * one thing the contract can actually answer.
 *
 * Each row carries both axes. "Published" and "changes under review" appear
 * beside each other, which is the entire reason `model/status.ts` exists: a
 * dashboard that derived one from the other would tell a seller their live
 * listing is offline, or never tell them their edit is being screened.
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
import type { ListingCard as ListingCardData } from "../api/types.js";
import { useMyListings } from "../headless/MyListings.js";
import type { MyListingsSource } from "../model/mineSource.js";
import { useListingActions } from "../headless/ListingActions.js";
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
  listing: ListingCardData;
  onEdit?: (id: number) => void;
}): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const actions = useListingActions(props.listing.id, props.listing.status);
  // The card list carries `status` but NOT `moderation_status`
  // (`ListingCardSerializer` omits it), so a row shows the moderation axis
  // only through the one thing the projection does say. Pending is the
  // honest default for the notice table's second argument here: it is the
  // value that produces a note only when the lifecycle also implies one.
  const status =
    props.listing.status === undefined
      ? undefined
      : listingStatusView(props.listing.status, "approved");

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
        title={props.listing.title ?? String(props.listing.id)}
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
  /** How the host gets the caller's own rows. Absent: the pane says the
   * contract cannot answer, and still shows the counts. */
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
              description={t(LISTINGS_I18N_KEYS.mineEmpty)}
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

        {/* The named gap. `matchList`'s `failed` arm above already renders
            "we could not load"; this states WHY once, in the pane, because
            the reason is a property of this deployment and not of this
            request. */}
        {props.source === undefined ? (
          <Alert
            type="warning"
            showIcon
            data-testid="listings-mine-source-missing"
            message={t(LISTINGS_I18N_KEYS.mineSourceMissing)}
          />
        ) : null}

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
