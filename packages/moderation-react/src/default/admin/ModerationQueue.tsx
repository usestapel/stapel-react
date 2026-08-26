/**
 * `<ModerationQueue>` — the cross-target triage list.
 *
 * ── The 403 here is a person, not a fault ─────────────────────────────────
 *
 * The nav surface axis has `public | member` and cannot say "staff", so a
 * container legitimately routes an ordinary member to this route (gdpr-react's
 * admin pane hit the same wall first). Rendering the mandate refusal as a
 * failed read would show an operations error to somebody who simply used the
 * wrong account, so `isStaffOnly` names it and the screen explains itself.
 *
 * ── Table or cards is an ELEMENT question ─────────────────────────────────
 *
 * A console is routinely mounted in an admin shell's content column or a
 * split view. antd's grid breakpoints read the VIEWPORT, which would give a
 * 380px panel on a 1920px desktop the eight-column table. `useElementWidth`
 * asks the only question that matters — how much room do I have.
 *
 * ── The target preview is a HOST seam ─────────────────────────────────────
 *
 * The backend serves the target's content on the CASE CARD only, never on a
 * list row: the module is domain-blind and a queue row carries `(type, key)`
 * and nothing else. `createModerationRuntime({ renderTarget })` is where a host
 * that owns the target puts a thumbnail; unfilled, the row shows `type:key`,
 * which is the truth rather than a blank column.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Card,
  Flex,
  Input,
  InputNumber,
  List,
  Segmented,
  Select,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { matchLoad, useI18n, useT } from "@stapel/core";
import { CASE_STATES } from "../../api/enums.js";
import type { CaseState } from "../../api/enums.js";
import type { Case } from "../../api/types.js";
import {
  MODERATION_I18N_KEYS,
  caseOriginKey,
  caseStateKey,
} from "../../i18n/keys.js";
import { useModerationQueue } from "../../headless/useModerationQueue.js";
import { useModerationRuntime } from "../../model/context.js";
import { formatInstant, shortId } from "../../model/format.js";
import { usePolicyText } from "../copy.js";
import { isNarrowWidth, useElementWidth } from "../elementWidth.js";
import type { ThemeModeProp } from "../types.js";
import { CaseDetail } from "./CaseDetail.js";

/** antd semantic presets only. A queue state is operational, not decorative. */
const STATE_TONE: Readonly<Record<CaseState, string>> = {
  open: "processing",
  screening: "processing",
  queued: "warning",
  claimed: "default",
  resolved: "success",
};

/** The filter bar's "no filter" sentinel — an empty query value, not a word
 * the backend could mistake for a state. */
const ANY = "";

export interface ModerationQueueProps extends ThemeModeProp {
  /** Who the reader is, so their own lease is told apart from a colleague's.
   * This module has no `/me`; the host knows. */
  readonly viewerId?: string;
  readonly "data-testid"?: string;
}

export function ModerationQueue(props: ModerationQueueProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const runtime = useModerationRuntime();
  const testId = props["data-testid"] ?? "moderation-queue";
  const bag = useModerationQueue();
  const policyText = usePolicyText();
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const narrow = isNarrowWidth(width);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);

  const label = (userId: string): string =>
    runtime.userLabel !== undefined ? runtime.userLabel(userId) : shortId(userId);

  const targetOf = (row: Case): ReactElement => (
    <Flex vertical>
      <Typography.Text>{`${row.target_type}:${row.target_key}`}</Typography.Text>
      {runtime.renderTarget !== undefined ? runtime.renderTarget(row) : null}
    </Flex>
  );

  const openButton = (row: Case): ReactElement => (
    <Button
      size="small"
      type="link"
      data-testid={`${testId}-open-${row.id}`}
      data-analytics="none"
      data-analytics-reason="opens the case card; the triage writes inside it step the tracked moderation.triage flow"
      onClick={() => {
        setOpenCaseId(row.id);
      }}
    >
      {t(MODERATION_I18N_KEYS.queueOpenCase)}
    </Button>
  );

  const columns = [
    {
      key: "state",
      title: t(MODERATION_I18N_KEYS.queueColState),
      render: (_: unknown, row: Case): ReactElement => (
        <Tag color={STATE_TONE[row.state]}>{t(caseStateKey(row.state))}</Tag>
      ),
    },
    {
      key: "target",
      title: t(MODERATION_I18N_KEYS.queueColTarget),
      render: (_: unknown, row: Case): ReactElement => targetOf(row),
    },
    {
      key: "origin",
      title: t(MODERATION_I18N_KEYS.queueColOrigin),
      render: (_: unknown, row: Case): string => t(caseOriginKey(row.origin)),
    },
    {
      key: "severity",
      title: t(MODERATION_I18N_KEYS.queueColSeverity),
      render: (_: unknown, row: Case): number => row.severity,
    },
    {
      key: "reports",
      title: t(MODERATION_I18N_KEYS.queueColReports),
      render: (_: unknown, row: Case): number => row.report_count,
    },
    {
      key: "claimed",
      title: t(MODERATION_I18N_KEYS.queueColClaimed),
      render: (_: unknown, row: Case): ReactElement =>
        row.claimed_by != null && row.claimed_by !== "" ? (
          <Flex vertical>
            <Typography.Text>{label(row.claimed_by)}</Typography.Text>
            {row.claimed_until != null ? (
              <Typography.Text type="secondary">
                {formatInstant(row.claimed_until, locale)}
              </Typography.Text>
            ) : null}
          </Flex>
        ) : (
          <Typography.Text type="secondary">
            {t(MODERATION_I18N_KEYS.caseLeaseFree)}
          </Typography.Text>
        ),
    },
    {
      key: "updated",
      title: t(MODERATION_I18N_KEYS.queueColUpdated),
      render: (_: unknown, row: Case): string => formatInstant(row.updated_at, locale),
    },
    {
      key: "open",
      title: t(MODERATION_I18N_KEYS.queueOpenCase),
      render: (_: unknown, row: Case): ReactElement => openButton(row),
    },
  ];

  const stateOptions = [
    { value: ANY, label: t(MODERATION_I18N_KEYS.queueFilterAny) },
    ...CASE_STATES.map((state) => ({
      value: state as string,
      label: t(caseStateKey(state)),
    })),
  ];

  const reasonOptions = matchLoad(bag.reasons, {
    loading: () => [],
    failed: () => [],
    ready: (reasons) =>
      reasons.map((reason) => ({
        value: reason.code,
        label: policyText.reasonLabel(reason),
      })),
  });

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <div ref={ref} data-testid={testId}>
        <Flex vertical gap={spacing["4"]}>
          <Flex gap={spacing["4"]} wrap data-testid={`${testId}-stats`}>
            {matchLoad(bag.stats, {
              loading: () => null,
              failed: () => null,
              ready: (stats) => (
                <>
                  <Statistic
                    title={t(MODERATION_I18N_KEYS.statsOpen)}
                    value={stats.open_total ?? 0}
                  />
                  <Statistic
                    title={t(MODERATION_I18N_KEYS.statsResolved)}
                    value={stats.resolved_total ?? 0}
                  />
                </>
              ),
            })}
          </Flex>

          <Card size="small" data-testid={`${testId}-filters`}>
            <Flex gap={spacing["3"]} wrap align="flex-end">
              <Flex vertical gap={spacing["1"]}>
                <Typography.Text type="secondary">
                  {t(MODERATION_I18N_KEYS.queueFilterState)}
                </Typography.Text>
                <Segmented
                  value={bag.filters.state ?? ANY}
                  options={stateOptions}
                  data-testid={`${testId}-filter-state`}
                  onChange={(value) => {
                    const next = String(value);
                    bag.setFilters({
                      ...bag.filters,
                      ...(next !== ANY ? { state: next } : { state: undefined }),
                    });
                  }}
                />
              </Flex>

              <Flex vertical gap={spacing["1"]}>
                <Typography.Text type="secondary">
                  {t(MODERATION_I18N_KEYS.queueFilterTargetType)}
                </Typography.Text>
                {bag.targetTypes === undefined ? (
                  <Typography.Text type="secondary" data-testid={`${testId}-no-types`}>
                    {t(MODERATION_I18N_KEYS.queueNoTargetTypes)}
                  </Typography.Text>
                ) : (
                  <Select
                    allowClear
                    value={bag.filters.targetType ?? undefined}
                    style={{ minWidth: "10rem" }}
                    aria-label={t(MODERATION_I18N_KEYS.queueFilterTargetType)}
                    data-testid={`${testId}-filter-type`}
                    options={bag.targetTypes.map((type) => ({
                      value: type,
                      label: type,
                    }))}
                    onChange={(value?: string) => {
                      bag.setFilters({ ...bag.filters, targetType: value });
                    }}
                  />
                )}
              </Flex>

              <Flex vertical gap={spacing["1"]}>
                <Typography.Text type="secondary">
                  {t(MODERATION_I18N_KEYS.queueFilterReason)}
                </Typography.Text>
                <Select
                  allowClear
                  value={bag.filters.reasonCode ?? undefined}
                  style={{ minWidth: "10rem" }}
                  aria-label={t(MODERATION_I18N_KEYS.queueFilterReason)}
                  data-testid={`${testId}-filter-reason`}
                  options={reasonOptions}
                  onChange={(value?: string) => {
                    bag.setFilters({ ...bag.filters, reasonCode: value });
                  }}
                />
              </Flex>

              <Flex vertical gap={spacing["1"]}>
                <Typography.Text type="secondary">
                  {t(MODERATION_I18N_KEYS.queueFilterSeverity)}
                </Typography.Text>
                <InputNumber
                  value={bag.filters.severityMin ?? null}
                  min={0}
                  aria-label={t(MODERATION_I18N_KEYS.queueFilterSeverity)}
                  data-testid={`${testId}-filter-severity`}
                  onChange={(value) => {
                    bag.setFilters({
                      ...bag.filters,
                      severityMin: typeof value === "number" ? value : undefined,
                    });
                  }}
                />
              </Flex>

              <Flex vertical gap={spacing["1"]}>
                <Typography.Text type="secondary">
                  {t(MODERATION_I18N_KEYS.queueFilterSubject)}
                </Typography.Text>
                <Input
                  allowClear
                  value={bag.filters.subjectUserId ?? ""}
                  style={{ minWidth: "12rem" }}
                  aria-label={t(MODERATION_I18N_KEYS.queueFilterSubject)}
                  data-testid={`${testId}-filter-subject`}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    bag.setFilters({
                      ...bag.filters,
                      subjectUserId: value !== "" ? value : undefined,
                    });
                  }}
                />
              </Flex>
            </Flex>
          </Card>

          <LoadList
            state={bag.rows}
            testId={testId}
            skeletonRows={4}
            onRetry={bag.refetch}
            failed={(error) =>
              bag.access === "staff_only" ? (
                <EmptyState
                  testId={`${testId}-staff-only`}
                  title={t(MODERATION_I18N_KEYS.queueStaffOnly)}
                  hint={t(MODERATION_I18N_KEYS.queueStaffOnlyHint)}
                />
              ) : (
                <ErrorAlert
                  testId={`${testId}-failed`}
                  thrown={error}
                  onRetry={bag.refetch}
                />
              )
            }
            empty={
              <EmptyState
                testId={`${testId}-empty`}
                title={t(MODERATION_I18N_KEYS.queueEmpty)}
                hint={t(MODERATION_I18N_KEYS.queueEmptyHint)}
              />
            }
          >
            {(rows) => (
              <Flex vertical gap={spacing["3"]}>
                {narrow ? (
                  <List
                    dataSource={[...rows]}
                    rowKey={(row: Case) => row.id}
                    data-testid={`${testId}-cards`}
                    renderItem={(row: Case) => (
                      <List.Item>
                        <Flex vertical gap={spacing["1"]} style={{ width: "100%" }}>
                          <Flex gap={spacing["2"]} align="center" wrap>
                            <Tag color={STATE_TONE[row.state]}>
                              {t(caseStateKey(row.state))}
                            </Tag>
                            <Typography.Text type="secondary">
                              {t(MODERATION_I18N_KEYS.caseSeverity, {
                                value: row.severity,
                              })}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {t(MODERATION_I18N_KEYS.caseReportCount, {
                                count: row.report_count,
                              })}
                            </Typography.Text>
                          </Flex>
                          {targetOf(row)}
                          <Typography.Text type="secondary">
                            {formatInstant(row.updated_at, locale)}
                          </Typography.Text>
                          {openButton(row)}
                        </Flex>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Table
                    size="small"
                    pagination={false}
                    scroll={{ x: true }}
                    rowKey={(row: Case) => row.id}
                    dataSource={[...rows]}
                    columns={columns}
                    data-testid={`${testId}-rows`}
                  />
                )}
                {bag.hasMore ? (
                  <GatedButton
                    gate={bag.loadMore}
                    testId={`${testId}-more`}
                    data-analytics="none"
                    data-analytics-reason="pagination — the same list, one keyset page further"
                    onClick={bag.runLoadMore}
                  >
                    {t(MODERATION_I18N_KEYS.queueLoadMore)}
                  </GatedButton>
                ) : null}
              </Flex>
            )}
          </LoadList>
        </Flex>

        <CaseDetail
          caseId={openCaseId ?? undefined}
          open={openCaseId !== null}
          onClose={() => {
            setOpenCaseId(null);
          }}
          data-testid={`${testId}-case`}
          {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
          {...(props.mode !== undefined ? { mode: props.mode } : {})}
        />
      </div>
    </SkinTheme>
  );
}
