/**
 * `<IssuesFeed>` — the triage board: every bug this fleet has recorded, one
 * row each, grouped by the service that reported it.
 *
 * ── Grouped by service, worst first ───────────────────────────────────────
 *
 * The wire order is "newest activity first", which answers "what moved" and
 * not "what is broken". In a fleet of a dozen services those are different
 * questions and the second one is why somebody opened this screen: a single
 * service throwing fatals is an outage, and the same twelve rows interleaved
 * with everybody's warnings reads as background noise. So the page is grouped
 * (`groupIssuesByService`) and the groups are ordered by their worst level and
 * then by how loud they are — never alphabetically, which would file an outage
 * under whatever letter it starts with.
 *
 * ── The three refusals are three different sentences ──────────────────────
 *
 * Every route here is `IsStaffUser`. A 403 means "signed in as the wrong
 * account", a 401 means "sign in again", and anything else is a failure to
 * READ the tracker. All three are named, and none of them is ever drawn as an
 * empty table: "nothing is broken" is the one sentence an error tracker must
 * not say by accident.
 *
 * ── The poll is conditional and says so quietly ───────────────────────────
 *
 * There is no stream in this module. The feed re-asks on the runtime's
 * interval with the `ETag` it holds, so the usual answer is a 304 and nothing
 * repaints. "Up to date" is one line of secondary text rather than a spinner,
 * because a board that flickers every minute is a board nobody leaves open.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Card, Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  DataTable,
  EmptyState,
  ErrorAlert,
  Page,
  SkinButton,
  StatusTag,
} from "@stapel/tokens-antd/skin";
import type { RowAction } from "@stapel/tokens-antd/skin";
import { matchList, useFormat, useT } from "@stapel/core";
import type { Issue } from "../api/types.js";
import type { IssueFeedFilters, IssueGroup } from "../model/issues.js";
import { useIssues } from "../model/issues.js";
import {
  isAlertsStaffOnly,
  isAlertsUnauthorized,
} from "../model/refusals.js";
import { ALERTS_I18N_KEYS } from "../i18n/keys.js";
import { IssueFilterBar } from "./IssueFilterBar.js";
import { levelFamily, levelKey, statusFamily, statusKey } from "./labels.js";
import type { IssueNavigationProps, ThemeModeProp } from "./types.js";

export interface IssuesFeedProps extends ThemeModeProp, IssueNavigationProps {
  /** Filters the screen opens with. The bar owns them from then on. */
  readonly initialFilters?: IssueFeedFilters;
  readonly testId?: string;
}

export function IssuesFeed(props: IssuesFeedProps): ReactElement {
  const t = useT();
  const fmt = useFormat();
  const testId = props.testId ?? "alerts-feed";
  const [filters, setFilters] = useState<IssueFeedFilters>(
    props.initialFilters ?? {}
  );
  const bag = useIssues(filters);

  const absent = t(ALERTS_I18N_KEYS.none);
  const anyFilter = Object.keys(filters).length > 0;

  // The services the caller can actually offer the filter bar: the ones on
  // this page. The tracker serves no service registry (there is a `Service`
  // table, and it is the reporters' key store, not a directory of names an
  // operator may filter by), so inventing a fuller list would mean inventing.
  const services =
    bag.rows.status === "ready"
      ? [...new Set(bag.rows.data.map((row) => row.service))].sort()
      : [];

  const rowActions = (row: Issue): readonly RowAction[] => {
    const href = props.issueHref?.(row.id);
    if (href === undefined && props.onOpenIssue === undefined) return [];
    return [
      {
        key: "open",
        label: t(ALERTS_I18N_KEYS.rowOpen),
        primary: true,
        testId: `${testId}-open-${row.id}`,
        ...(href !== undefined
          ? { href }
          : { onClick: () => props.onOpenIssue?.(row.id) }),
      },
    ];
  };

  const group = (entry: IssueGroup): ReactElement => (
    <Card
      key={entry.service}
      size="small"
      title={
        <Flex gap={spacing[2]} align="center" wrap>
          <StatusTag
            status={levelFamily(entry.worstLevel)}
            testId={`${testId}-group-level-${entry.service}`}
          >
            {t(levelKey(entry.worstLevel), { level: entry.worstLevel })}
          </StatusTag>
          <Typography.Text strong>{entry.service}</Typography.Text>
        </Flex>
      }
      extra={
        <Typography.Text type="secondary">
          {t(ALERTS_I18N_KEYS.feedGroupSummary, {
            issues: entry.issues.length,
            count: entry.count,
          })}
        </Typography.Text>
      }
      data-testid={`${testId}-group-${entry.service}`}
    >
      <DataTable<Issue>
        rows={entry.issues}
        rowKey={(row) => row.id}
        ariaLabel={entry.service}
        testId={`${testId}-rows-${entry.service}`}
        rowActions={rowActions}
        columns={[
          {
            key: "title",
            title: t(ALERTS_I18N_KEYS.colIssue),
            cardRole: "title",
            render: (row) => (
              <Flex vertical>
                <Typography.Text>{row.title}</Typography.Text>
                <Typography.Text type="secondary">
                  {row.culprit.length > 0 ? row.culprit : absent}
                </Typography.Text>
              </Flex>
            ),
          },
          {
            key: "level",
            title: t(ALERTS_I18N_KEYS.colLevel),
            cardRole: "badge",
            render: (row) => (
              <StatusTag
                status={levelFamily(row.level)}
                testId={`${testId}-level-${row.id}`}
              >
                {t(levelKey(row.level), { level: row.level })}
              </StatusTag>
            ),
          },
          {
            key: "status",
            title: t(ALERTS_I18N_KEYS.colStatus),
            cardRole: "badge",
            render: (row) => (
              <StatusTag
                status={statusFamily(row.status)}
                testId={`${testId}-status-${row.id}`}
              >
                {t(statusKey(row.status), { status: row.status })}
              </StatusTag>
            ),
          },
          {
            key: "count",
            title: t(ALERTS_I18N_KEYS.colCount),
            align: "end",
            render: (row) => (
              <Flex vertical align="end">
                <Typography.Text>{String(row.count)}</Typography.Text>
                {row.status === "regressed" ? (
                  <Typography.Text type="secondary">
                    {t(ALERTS_I18N_KEYS.rowSinceFix, {
                      count: row.count_since_fix,
                    })}
                  </Typography.Text>
                ) : null}
              </Flex>
            ),
          },
          {
            key: "seen",
            title: t(ALERTS_I18N_KEYS.colLastSeen),
            render: (row) => (
              <Flex vertical>
                <Typography.Text>
                  {fmt.relative(row.last_seen) ?? absent}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {t(ALERTS_I18N_KEYS.rowSeenRange, {
                    first: fmt.relative(row.first_seen) ?? absent,
                    last: fmt.relative(row.last_seen) ?? absent,
                  })}
                </Typography.Text>
              </Flex>
            ),
          },
        ]}
      />
    </Card>
  );

  const from = bag.total === 0 ? 0 : bag.offset + 1;
  const to = Math.min(bag.offset + bag.pageSize, bag.total);

  return (
    <Page
      title={t(ALERTS_I18N_KEYS.feedTitle)}
      intro={t(ALERTS_I18N_KEYS.feedIntro)}
      data-testid={testId}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      actions={
        <Flex gap={spacing[2]} align="center">
          <Typography.Text type="secondary" data-testid={`${testId}-freshness`}>
            {bag.isFetching
              ? t(ALERTS_I18N_KEYS.feedChecking)
              : t(ALERTS_I18N_KEYS.feedUpToDate)}
          </Typography.Text>
          <SkinButton
            size="small"
            data-testid={`${testId}-refresh`}
            data-analytics="none"
            data-analytics-reason="a conditional re-read of a board — no decision was taken"
            onClick={bag.refetch}
          >
            {t(ALERTS_I18N_KEYS.feedRefresh)}
          </SkinButton>
        </Flex>
      }
    >
      <Flex vertical gap={spacing[4]}>
        <IssueFilterBar
          value={filters}
          onChange={setFilters}
          services={services}
          testId={`${testId}-filters`}
          {...(props.mode !== undefined ? { mode: props.mode } : {})}
        />

        {matchList<IssueGroup, ReactElement>(bag.groups, {
          loading: () => (
            <Typography.Text type="secondary" data-testid={`${testId}-loading`}>
              {t(ALERTS_I18N_KEYS.feedLoading)}
            </Typography.Text>
          ),
          failed: (error) =>
            isAlertsStaffOnly(error) ? (
              <EmptyState
                testId={`${testId}-staff-only`}
                title={t(ALERTS_I18N_KEYS.feedStaffOnly)}
                hint={t(ALERTS_I18N_KEYS.feedStaffOnlyHint)}
              />
            ) : isAlertsUnauthorized(error) ? (
              <EmptyState
                testId={`${testId}-signed-out`}
                title={t(ALERTS_I18N_KEYS.feedSignedOut)}
                hint={t(ALERTS_I18N_KEYS.feedSignedOutHint)}
              />
            ) : (
              <ErrorAlert
                testId={`${testId}-failed`}
                thrown={error}
                message={t(ALERTS_I18N_KEYS.feedFailed)}
                onRetry={bag.refetch}
              />
            ),
          empty: () => (
            <EmptyState
              testId={`${testId}-empty`}
              title={t(
                anyFilter
                  ? ALERTS_I18N_KEYS.feedEmptyFiltered
                  : ALERTS_I18N_KEYS.feedEmpty
              )}
              hint={t(
                anyFilter
                  ? ALERTS_I18N_KEYS.feedEmptyFilteredHint
                  : ALERTS_I18N_KEYS.feedEmptyHint
              )}
              {...(anyFilter
                ? {
                    action: (
                      <SkinButton
                        data-testid={`${testId}-empty-clear`}
                        data-analytics="none"
                        data-analytics-reason="clearing a filter is a view change, not a decision about a bug"
                        onClick={() => setFilters({})}
                      >
                        {t(ALERTS_I18N_KEYS.filterClear)}
                      </SkinButton>
                    ),
                  }
                : {})}
            />
          ),
          ready: (groups) => (
            <Flex vertical gap={spacing[4]} data-testid={`${testId}-groups`}>
              {groups.map(group)}
              <Flex gap={spacing[3]} align="center" justify="end" wrap>
                <Typography.Text type="secondary" data-testid={`${testId}-range`}>
                  {t(ALERTS_I18N_KEYS.feedRange, {
                    from,
                    to,
                    total: bag.total,
                  })}
                </Typography.Text>
                <SkinButton
                  size="small"
                  disabled={!bag.hasPrevious}
                  data-testid={`${testId}-previous`}
                  data-analytics="none"
                  data-analytics-reason="paging a board — no decision was taken about a bug"
                  onClick={bag.previousPage}
                >
                  {t(ALERTS_I18N_KEYS.feedPrevious)}
                </SkinButton>
                <SkinButton
                  size="small"
                  disabled={!bag.hasNext}
                  data-testid={`${testId}-next`}
                  data-analytics="none"
                  data-analytics-reason="paging a board — no decision was taken about a bug"
                  onClick={bag.nextPage}
                >
                  {t(ALERTS_I18N_KEYS.feedNext)}
                </SkinButton>
              </Flex>
            </Flex>
          ),
        })}
      </Flex>
    </Page>
  );
}
