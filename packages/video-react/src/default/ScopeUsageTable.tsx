/**
 * `<ScopeUsageTable>` — the antd rendering of one month of one partition's
 * call time.
 *
 * FIVE outcomes, five sentences, and the whole point is that none of them
 * collapses into another:
 *
 *   loading         — we are asking
 *   failed          — we could not ask            (retry, never "nothing here")
 *   unavailable     — the uniform 404             (see below)
 *   invalid period  — the question itself is out of range (1..36 months)
 *   empty           — we asked, nobody was in a call this month
 *
 * ── The 404 arm is the reason this component is not a `<Table/>` ──────────
 *
 * `error.404.video_scope_not_found` is returned for THREE different
 * situations — the scope does not exist, the scope holds no calls, and the
 * reader holds no `USAGE_MANDATE` in it — deliberately, because a 403 would
 * confirm to a person guessing tenant ids that the one they guessed is real.
 * A table that rendered zero rows there would be manufacturing a claim about
 * the workspace out of a refusal to answer: exactly the `data ?? []` defect
 * `@stapel/core`'s `LoadState` exists to prevent, one status code further out.
 * So the arm says "not available for this workspace" and stops.
 *
 * ── Geometry comes off the ELEMENT ────────────────────────────────────────
 *
 * Four columns and a footer do not fit a 390px screen, and they do not fit a
 * 320px sidebar on a 1440px desktop either. `useNarrow` measures the pane's own
 * box and swaps the table for one card per person — no horizontal page scroll
 * in either case, and no viewport media query that would have got the sidebar
 * wrong.
 *
 * ── The person column is a SLOT ───────────────────────────────────────────
 *
 * The wire carries `user_id` and nothing else about the person: stapel-video
 * keeps no FK to a user by design, so erasure can pseudonymize the column. The
 * host resolves the display name (`nameFor`) from the roster its admin page
 * already loaded. Absent, the id is printed — for a report about individuals,
 * a blank cell would be worse than an ugly one.
 */
import type { ReactElement, ReactNode } from "react";
import { Button, Card, Flex, Select, Skeleton, Table, Typography, theme } from "antd";
import { matchList, useT, useTPlural } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ScopeUsageRow } from "../api/types.js";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import {
  formatPresence,
  isInvalidUsagePeriod,
  isScopeUnavailable,
  usageTotals,
} from "../model/usage.js";
import type { ThemeModeProp } from "./types.js";
import { useNarrow } from "./useNarrow.js";

export interface ScopeUsageTableProps extends ThemeModeProp {
  /** The shown month's rows — a `LoadState`, so "could not ask" cannot be
   * mistaken for "nobody talked". */
  readonly rows: LoadState<readonly ScopeUsageRow[]>;
  /** Turn a `user_id` into something a reader recognises. See the header. */
  readonly nameFor?: (userId: string) => ReactNode;
  /** The month on screen, `YYYY-MM`. */
  readonly month?: string;
  /** The selector's options, newest first. Absent or empty hides the
   * selector — a control with nothing to choose is noise. */
  readonly months?: readonly string[];
  /** Called with the picked `YYYY-MM`. Absent renders the month as text. */
  readonly onMonthChange?: (month: string) => void;
  /** Retry affordance for the failed arm. Absent renders no button. */
  readonly onRefresh?: () => void;
}

function MonthPicker(props: {
  month: string | undefined;
  months: readonly string[] | undefined;
  onMonthChange: ((month: string) => void) | undefined;
}): ReactElement | null {
  const t = useT();
  const { token } = theme.useToken();
  const { month, months, onMonthChange } = props;
  if (month === undefined && (months === undefined || months.length === 0)) {
    return null;
  }
  const label = (
    <Typography.Text type="secondary">
      {t(VIDEO_I18N_KEYS.usageMonthLabel)}
    </Typography.Text>
  );
  if (onMonthChange === undefined || months === undefined || months.length === 0) {
    return (
      <Flex align="center" gap={token.paddingXS}>
        {label}
        <Typography.Text strong data-testid="video-usage-month">
          {month}
        </Typography.Text>
      </Flex>
    );
  }
  return (
    <Flex align="center" gap={token.paddingXS}>
      {label}
      <Select
        data-testid="video-usage-month-select"
        aria-label={t(VIDEO_I18N_KEYS.usageMonthLabel)}
        {...(month !== undefined ? { value: month } : {})}
        onChange={onMonthChange}
        options={months.map((m) => ({ value: m, label: m }))}
        style={{ minWidth: "8rem" }}
        data-analytics="none"
        data-analytics-reason="switching the reported period is a read — the host app wraps this with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      />
    </Flex>
  );
}

function UsageFooter(props: { rows: readonly ScopeUsageRow[] }): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { token } = theme.useToken();
  const totals = usageTotals(props.rows);
  return (
    <Flex vertical gap={token.paddingXXS} data-testid="video-usage-total">
      <Flex gap={token.padding} wrap align="baseline">
        <Typography.Text strong>
          {t(VIDEO_I18N_KEYS.usageTotalLabel)}
        </Typography.Text>
        <Typography.Text data-testid="video-usage-total-time">
          {formatPresence(totals.presenceSeconds)}
        </Typography.Text>
        <Typography.Text type="secondary">
          {tPlural(VIDEO_I18N_KEYS.usageTotalPeople, { count: totals.people })}
        </Typography.Text>
        <Typography.Text type="secondary">
          {tPlural(VIDEO_I18N_KEYS.usageTotalAttendances, {
            count: totals.attendances,
          })}
        </Typography.Text>
      </Flex>
      {/* "attendances", not "calls": this is a SUM of per-person distinct-room
          counts, so three people in one meeting make three. The sentence is
          ON the page — a hover would be unreachable by keyboard and absent on
          touch, which is where this report is read. */}
      <Typography.Text
        type="secondary"
        data-testid="video-usage-attendances-hint"
        style={{ fontSize: token.fontSizeSM }}
      >
        {t(VIDEO_I18N_KEYS.usageAttendancesHint)}
      </Typography.Text>
    </Flex>
  );
}

/** One person, as a card — the arm a narrow box gets instead of four columns. */
function PersonCard(props: {
  row: ScopeUsageRow;
  name: ReactNode;
}): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const { row, name } = props;
  const line = (label: string, value: ReactNode): ReactElement => (
    <Flex justify="space-between" gap={token.paddingXS}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text>{value}</Typography.Text>
    </Flex>
  );
  return (
    <Card size="small" data-testid="video-usage-card">
      <Flex vertical gap={token.paddingXXS}>
        <Typography.Text strong>{name}</Typography.Text>
        {line(
          t(VIDEO_I18N_KEYS.usageColumnTalkTime),
          formatPresence(row.presence_seconds)
        )}
        {line(t(VIDEO_I18N_KEYS.usageColumnCalls), row.rooms)}
        {line(t(VIDEO_I18N_KEYS.usageColumnConnections), row.connections)}
      </Flex>
    </Card>
  );
}

export function ScopeUsageTable(props: ScopeUsageTableProps): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const { mode, rows, nameFor, month, months, onMonthChange, onRefresh } = props;
  const { ref, narrow } = useNarrow<HTMLDivElement>();

  const displayName = (row: ScopeUsageRow): ReactNode =>
    nameFor?.(row.user_id) ?? row.user_id;

  const columns = [
    {
      key: "person",
      title: t(VIDEO_I18N_KEYS.usageColumnPerson),
      render: (_: unknown, row: ScopeUsageRow): ReactNode => displayName(row),
    },
    {
      key: "talk",
      title: t(VIDEO_I18N_KEYS.usageColumnTalkTime),
      align: "right" as const,
      render: (_: unknown, row: ScopeUsageRow): ReactNode =>
        formatPresence(row.presence_seconds),
    },
    {
      key: "calls",
      title: t(VIDEO_I18N_KEYS.usageColumnCalls),
      align: "right" as const,
      render: (_: unknown, row: ScopeUsageRow): ReactNode => row.rooms,
    },
    {
      key: "connections",
      title: t(VIDEO_I18N_KEYS.usageColumnConnections),
      align: "right" as const,
      render: (_: unknown, row: ScopeUsageRow): ReactNode => row.connections,
    },
  ];

  const retry =
    onRefresh !== undefined ? (
      <Button
        size="small"
        onClick={onRefresh}
        data-analytics="none"
        data-analytics-reason="recovery affordance for a failed read — host app wraps with its own tracked()"
      >
        {t(VIDEO_I18N_KEYS.usageRefresh)}
      </Button>
    ) : undefined;

  return (
    <SkinTheme {...(mode !== undefined ? { mode } : {})}>
      <Flex
        vertical
        gap={token.paddingXS}
        data-testid="video-usage"
        ref={ref}
        style={{ maxWidth: "100%" }}
      >
        <Flex align="center" justify="space-between" gap={token.padding} wrap>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t(VIDEO_I18N_KEYS.usageHeading)}
          </Typography.Title>
          <MonthPicker
            month={month}
            months={months}
            onMonthChange={onMonthChange}
          />
        </Flex>

        {matchList(rows, {
          // antd's <Skeleton> does not forward unknown props to the DOM, so
          // the marker lives on a wrapper rather than silently disappearing.
          loading: () => (
            <div
              data-testid="video-usage-loading"
              role="status"
              aria-busy
              aria-label={t(VIDEO_I18N_KEYS.usageLoading)}
            >
              <Skeleton active />
            </div>
          ),
          failed: (error) => {
            if (isScopeUnavailable(error)) {
              return (
                <EmptyState
                  testId="video-usage-unavailable"
                  title={t(VIDEO_I18N_KEYS.usageUnavailable)}
                />
              );
            }
            if (isInvalidUsagePeriod(error)) {
              return (
                <EmptyState
                  testId="video-usage-invalid-period"
                  title={t(VIDEO_I18N_KEYS.usageInvalidPeriod)}
                />
              );
            }
            return (
              <ErrorAlert
                testId="video-usage-failed"
                thrown={error}
                {...(retry !== undefined ? { action: retry } : {})}
              />
            );
          },
          empty: () => (
            <EmptyState
              testId="video-usage-empty"
              title={t(VIDEO_I18N_KEYS.usageEmpty)}
            />
          ),
          ready: (people) =>
            narrow ? (
              <Flex vertical gap={token.paddingXS} data-testid="video-usage-rows">
                {people.map((row) => (
                  <PersonCard
                    key={row.user_id}
                    row={row}
                    name={displayName(row)}
                  />
                ))}
                <UsageFooter rows={people} />
              </Flex>
            ) : (
              <Table
                data-testid="video-usage-rows"
                size="small"
                rowKey={(row: ScopeUsageRow) => row.user_id}
                dataSource={[...people]}
                columns={columns}
                pagination={false}
                footer={() => <UsageFooter rows={people} />}
              />
            ),
        })}
      </Flex>
    </SkinTheme>
  );
}
