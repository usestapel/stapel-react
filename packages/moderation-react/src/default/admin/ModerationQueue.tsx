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
 *
 * ── Two tabs, two numbers, and never their sum ────────────────────────────
 *
 * Backend 0.7.0 gave a screening FAILURE its own state, and this screen is
 * where that split has to survive contact with a person. The queue tab asks
 * for `state=queued` explicitly (an unfiltered read now returns dead letters
 * too); the DLQ tab is `<DlqQueue>` and belongs to whoever repairs the seam.
 * The header prints `queue_total` and `dlq_total` side by side and does NOT
 * print `open_total`, which adds them: that sum is precisely how a 78%
 * screening failure rate spent twelve days on a client stand looking like a
 * busy queue, and a console that shows it puts the defect back.
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
  Tabs,
  Tag,
  Typography,
} from "antd";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  matchLoad,
  useI18n,
  useT,
  useTPlural,
} from "@stapel/core";
import { CASE_STATES } from "../../api/enums.js";
import type { Case } from "../../api/types.js";
import {
  MODERATION_I18N_KEYS,
  caseOriginKey,
  caseStateKey,
} from "../../i18n/keys.js";
import {
  DEFAULT_QUEUE_STATE,
  useModerationQueue,
} from "../../headless/useModerationQueue.js";
import { useModerationRuntime } from "../../model/context.js";
import { formatInstant, shortId } from "../../model/format.js";
import { usePolicyText } from "../copy.js";
import { isNarrowWidth, useElementWidth } from "../elementWidth.js";
import type { ThemeModeProp } from "../types.js";
import { CaseDetail } from "./CaseDetail.js";
import { DlqQueue } from "./DlqQueue.js";
import { STATE_TONE } from "./tone.js";

/** Which half of the console is showing. */
export type ModerationQueueTab = "queue" | "dlq";

export interface ModerationQueueProps extends ThemeModeProp {
  /** Who the reader is, so their own lease is told apart from a colleague's.
   * This module has no `/me`; the host knows. */
  readonly viewerId?: string;
  /** Which tab opens first. A host that routes `/moderation/dlq` at this
   * screen passes `"dlq"`; the default is the moderator's own work. */
  readonly initialTab?: ModerationQueueTab;
  readonly "data-testid"?: string;
}

export function ModerationQueue(props: ModerationQueueProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const runtime = useModerationRuntime();
  const testId = props["data-testid"] ?? "moderation-queue";
  const bag = useModerationQueue();
  const policyText = usePolicyText();
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const narrow = isNarrowWidth(width);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useState<ModerationQueueTab>(props.initialTab ?? "queue");

  const label = (userId: string): string =>
    runtime.userLabel !== undefined ? runtime.userLabel(userId) : shortId(userId);

  // `listing:8842` is a lookup key wearing the clothes of a title. The kind is
  // the line a moderator reads; the key is the caption under it, which is what
  // an id is for. A host that fills `renderTarget` replaces both.
  const targetOf = (row: Case): ReactElement => (
    <Flex vertical>
      <Typography.Text style={{ textTransform: "capitalize" }}>
        {row.target_type}
      </Typography.Text>
      <Typography.Text type="secondary">{row.target_key}</Typography.Text>
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

  /**
   * Every state a MODERATOR's list can be narrowed to.
   *
   * Two members are gone since backend 0.7.0, for the same reason. `dlq` is
   * not a filter of this list at all — it is the other tab, and offering it
   * here would put an outage back in a moderator's queue with one click. And
   * there is no "Any" any more: "any state" is spelled as an empty `state` on
   * the wire, which is exactly the read that returns dead letters mixed in.
   * The control therefore always names a state, and `queued` is where it
   * starts.
   */
  const stateOptions = CASE_STATES.filter((state) => state !== "dlq").map(
    (state) => ({ value: state as string, label: t(caseStateKey(state)) })
  );

  /** How many filters are narrowing the queue right now — the one fact the
   * phone arm's collapsed "Filters" button has to carry, since the fields
   * themselves are behind it. */
  const activeFilterCount = [
    bag.filters.state !== undefined && bag.filters.state !== DEFAULT_QUEUE_STATE
      ? bag.filters.state
      : undefined,
    bag.filters.targetType,
    bag.filters.reasonCode,
    bag.filters.severityMin,
    bag.filters.subjectUserId,
  ].filter((value) => value !== undefined && value !== "").length;

  const reasonOptions = matchLoad(bag.reasons, {
    loading: () => [],
    failed: () => [],
    ready: (reasons) =>
      reasons.map((reason) => ({
        value: reason.code,
        label: policyText.reasonLabel(reason),
      })),
  });

  /**
   * The five filter fields, laid out along one axis.
   *
   * They are ONE definition rendered in two arms because the phone arm puts
   * them in a sheet: a second copy would be the pair of filter bars that
   * disagree about which field exists, which is how a filter silently stops
   * being applied on one surface only.
   */
  function filterFields(vertical: boolean): ReactElement {
    return (
      <Flex
        gap={spacing["3"]}
        wrap
        vertical={vertical}
        align={vertical ? "stretch" : "flex-end"}
      >
        <Flex vertical gap={spacing["1"]} style={{ minWidth: 0 }}>
          <Typography.Text type="secondary">
            {t(MODERATION_I18N_KEYS.queueFilterState)}
          </Typography.Text>
          {/* A `Segmented` measures its widest possible row and refuses to
              shrink below it. Six states at 390px are 668px of intrinsic
              width, and it dragged the WHOLE page out of the viewport — the
              stats, the cards and the filter card were all sliced by the
              right edge. It scrolls inside its own box instead. */}
          <div style={{ maxWidth: "100%", overflowX: "auto" }}>
            <Segmented
              value={bag.filters.state ?? DEFAULT_QUEUE_STATE}
              options={stateOptions}
              data-testid={`${testId}-filter-state`}
              onChange={(value) => {
                bag.setFilters({ ...bag.filters, state: String(value) });
              }}
            />
          </div>
        </Flex>

        <Flex vertical gap={spacing["1"]} style={{ minWidth: 0 }}>
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

        <Flex vertical gap={spacing["1"]} style={{ minWidth: 0 }}>
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

        <Flex vertical gap={spacing["1"]} style={{ minWidth: 0 }}>
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

        <Flex vertical gap={spacing["1"]} style={{ minWidth: 0 }}>
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
    );
  }

  /**
   * Where there is room the five fields stand in a card; where there is not,
   * they collapse behind one control that says how many of them are on. A
   * filter bar is the most width-hungry part of a console and the least of
   * what a moderator came for.
   */
  function filterBlock(): ReactElement {
    if (!narrow) {
      return (
        <Card size="small" data-testid={`${testId}-filters`}>
          {filterFields(false)}
        </Card>
      );
    }
    return (
      <Flex align="center" gap={spacing["3"]} data-testid={`${testId}-filters`}>
        <GatedButton
          gate={actionAvailable()}
          testId={`${testId}-filters-open`}
          data-analytics="none"
          data-analytics-reason="local-ui-open-filter-sheet"
          onClick={() => {
            setFiltersOpen(true);
          }}
        >
          {t(MODERATION_I18N_KEYS.queueFilters)}
        </GatedButton>
        <Typography.Text type="secondary">
          {activeFilterCount === 0
            ? t(MODERATION_I18N_KEYS.queueFiltersNone)
            : tPlural(MODERATION_I18N_KEYS.queueFiltersActive, {
                count: activeFilterCount,
              })}
        </Typography.Text>
      </Flex>
    );
  }

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <div ref={ref} data-testid={testId}>
        <Flex vertical gap={spacing["4"]}>
          <Typography.Title level={3} style={{ margin: spacing["0"] }}>
            {t(MODERATION_I18N_KEYS.queueTitle)}
          </Typography.Title>

          <Flex gap={spacing["6"]} wrap data-testid={`${testId}-stats`}>
            {matchLoad(bag.stats, {
              loading: () => null,
              failed: () => null,
              ready: (stats) => (
                <>
                  {/* Two numbers, never one. `queue_total` is what a
                      MODERATOR owes and `dlq_total` is what an ENGINEER owes;
                      `open_total` is their sum and is deliberately not drawn
                      here, because reading it as "the queue" is the mistake
                      that hid a 78% screening failure rate for twelve days. */}
                  <Statistic
                    title={t(MODERATION_I18N_KEYS.statsQueue)}
                    value={stats.queue_total ?? 0}
                  />
                  <Statistic
                    title={t(MODERATION_I18N_KEYS.statsDlq)}
                    value={stats.dlq_total ?? 0}
                  />
                  <Statistic
                    title={t(MODERATION_I18N_KEYS.statsResolved)}
                    value={stats.resolved_total ?? 0}
                  />
                </>
              ),
            })}
          </Flex>

          <Tabs
            activeKey={tab}
            data-testid={`${testId}-tabs`}
            onChange={(key) => {
              setTab(key as ModerationQueueTab);
            }}
            items={[
              {
                key: "queue",
                label: t(MODERATION_I18N_KEYS.queueTabQueue),
                children: (
                  <Flex vertical gap={spacing["4"]}>
                    {filterBlock()}

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
                                        {tPlural(MODERATION_I18N_KEYS.caseReportCount, {
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
                              scroll={{ x: "max-content" }}
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
                ),
              },
              {
                key: "dlq",
                // The label is the literal "DLQ" in every locale, with the
                // translated sentence under it. The word is an ENGINEER's
                // word and it stays untranslated on purpose: a moderator who
                // does not recognise it is being told correctly that this tab
                // is not theirs, which a friendly translation would hide.
                label: (
                  <Flex vertical align="flex-start">
                    <Typography.Text>
                      {t(MODERATION_I18N_KEYS.dlqLabel)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {t(MODERATION_I18N_KEYS.dlqSubtitle)}
                    </Typography.Text>
                  </Flex>
                ),
                children: (
                  <DlqQueue
                    data-testid={`${testId}-dlq`}
                    {...(props.viewerId !== undefined
                      ? { viewerId: props.viewerId }
                      : {})}
                    {...(props.mode !== undefined ? { mode: props.mode } : {})}
                  />
                ),
              },
            ]}
          />
        </Flex>

        <SkinDialog
          open={filtersOpen}
          onClose={() => {
            setFiltersOpen(false);
          }}
          title={t(MODERATION_I18N_KEYS.queueFilters)}
          dismissLabel={t(MODERATION_I18N_KEYS.dialogDismiss)}
          data-testid={`${testId}-filter-sheet`}
          footer={
            <Flex gap={spacing["2"]} justify="flex-end">
              <GatedButton
                gate={
                  activeFilterCount > 0
                    ? actionAvailable()
                    : actionBlocked(MODERATION_I18N_KEYS.queueFiltersNone)
                }
                testId={`${testId}-filters-clear`}
                data-analytics="none"
                data-analytics-reason="local-ui-reset-filter-state"
                onClick={() => {
                  bag.setFilters({});
                }}
              >
                {t(MODERATION_I18N_KEYS.queueFiltersClear)}
              </GatedButton>
              <GatedButton
                gate={actionAvailable()}
                type="primary"
                testId={`${testId}-filters-apply`}
                data-analytics="none"
                data-analytics-reason="local-ui-close-filter-sheet"
                onClick={() => {
                  setFiltersOpen(false);
                }}
              >
                {t(MODERATION_I18N_KEYS.queueFiltersApply)}
              </GatedButton>
            </Flex>
          }
        >
          {filterFields(true)}
        </SkinDialog>

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
