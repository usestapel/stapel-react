/**
 * `<DlqQueue>` — the dead-letter park: cases the screening seam gave up on.
 *
 * ── This is not a heavier queue, and the screen says so twice ─────────────
 *
 * The tab is labelled `DLQ` — untranslated, in every locale — with "screening
 * failures, not decisions" under it, and the pane repeats the point in a
 * sentence before the first row. That redundancy is deliberate. Until backend
 * 0.7.0 a broken screener wrote `policy_default / needs_review` and the case
 * joined the moderator's queue, where "a machine looked and was unsure" and
 * "no machine ever looked" were the same row wearing the same verdict; on a
 * client stand that produced 567 machine verdicts of which not one was a
 * judgement. A console that renders the park as one more queue re-creates
 * exactly that, in the layer that was supposed to fix it.
 *
 * ── Grouped by what broke, because that is what gets repaired ─────────────
 *
 * Rows are grouped by `last_error_class` (a closed vocabulary — see
 * `services.ERROR_CLASSES`) with the class as a chip and the server's own
 * message one click away, because an engineer empties this park one FAULT at
 * a time: the stand this state was built for was running two unrelated ones
 * at once, and a single "screening unavailable" counter sent people to repair
 * the wrong one.
 *
 * ── "Screen them all again" is the row action, N times ────────────────────
 *
 * There is no bulk route on the wire and this does not invent one: it walks
 * the loaded rows calling `POST cases/<id>/rescan` in turn, counting as it
 * goes. The count is the honest half — a button that says "done" after firing
 * twenty requests it never watched would be the same lie in a smaller place.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Flex, List, Select, Tag, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionBlocked,
  useDescribeFlowError,
  useI18n,
  useT,
  useTPlural,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { ERROR_CLASSES } from "../../api/enums.js";
import type { Case } from "../../api/types.js";
import { MODERATION_I18N_KEYS, caseStateKey } from "../../i18n/keys.js";
import { useModerationDlq } from "../../headless/useModerationDlq.js";
import type { DlqGroup } from "../../headless/useModerationDlq.js";
import { useModerationRuntime } from "../../model/context.js";
import { formatInstant } from "../../model/format.js";
import { caseRefusalKey } from "../copy.js";
import type { ThemeModeProp } from "../types.js";
import { CaseDetail } from "./CaseDetail.js";
import { STATE_TONE } from "./tone.js";

/** The filter's "every class" sentinel — an empty query value. */
const ANY = "";

export interface DlqQueueProps extends ThemeModeProp {
  /** Who the reader is, handed on to the case card so their own lease is told
   * apart from a colleague's. This module has no `/me`; the host knows. */
  readonly viewerId?: string;
  readonly "data-testid"?: string;
}

export function DlqQueue(props: DlqQueueProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const runtime = useModerationRuntime();
  const testId = props["data-testid"] ?? "moderation-dlq";
  const bag = useModerationDlq();
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const refusal = bag.state.step === "refused" ? bag.state.error : undefined;
  const namedRefusal = refusal !== undefined ? caseRefusalKey(refusal) : undefined;

  const instant = (iso: string | null | undefined): string =>
    iso == null || iso === ""
      ? t(MODERATION_I18N_KEYS.unknownValue)
      : formatInstant(iso, locale);

  /** A row already sent back is not a row to send back again — and it says
   * which, rather than going quietly grey. */
  const rowGate = (row: Case): ActionAvailability =>
    row.state !== "dlq"
      ? actionBlocked(MODERATION_I18N_KEYS.dlqRevived)
      : bag.rescan;

  const classOptions = [
    { value: ANY, label: t(MODERATION_I18N_KEYS.dlqFilterAny) },
    // The vocabulary, not the classes present on THIS page: a park emptied
    // down to one class must still offer the filter that shows it is empty of
    // the others.
    ...ERROR_CLASSES.map((name) => ({ value: name as string, label: name })),
  ];

  function progressLine(): ReactElement | null {
    if (bag.progress.total === 0) return null;
    return (
      <Flex gap={spacing["2"]} align="center" data-testid={`${testId}-progress`}>
        <Typography.Text type="secondary" role="status">
          {t(MODERATION_I18N_KEYS.dlqRescanProgress, {
            done: bag.progress.done,
            total: bag.progress.total,
          })}
        </Typography.Text>
        {bag.progress.failed > 0 ? (
          <Typography.Text type="danger" data-testid={`${testId}-progress-failed`}>
            {t(MODERATION_I18N_KEYS.dlqRescanFailed, {
              count: bag.progress.failed,
            })}
          </Typography.Text>
        ) : null}
      </Flex>
    );
  }

  function row(item: Case): ReactElement {
    const expanded = openError === item.id;
    return (
      <List.Item data-testid={`${testId}-row-${item.id}`}>
        <Flex vertical gap={spacing["1"]} style={{ width: "100%" }}>
          <Flex gap={spacing["2"]} align="center" wrap>
            <Tag color={STATE_TONE[item.state]}>{t(caseStateKey(item.state))}</Tag>
            <Typography.Text style={{ textTransform: "capitalize" }}>
              {item.target_type}
            </Typography.Text>
            <Typography.Text type="secondary">{item.target_key}</Typography.Text>
            {runtime.renderTarget !== undefined ? runtime.renderTarget(item) : null}
          </Flex>
          <Typography.Text type="secondary">
            {t(MODERATION_I18N_KEYS.dlqSince, { date: instant(item.dlq_at) })}
          </Typography.Text>
          <Flex gap={spacing["2"]} wrap align="center">
            <GatedButton
              gate={rowGate(item)}
              size="small"
              testId={`${testId}-rescan-${item.id}`}
              data-analytics="flow"
              onClick={() => {
                bag.runRescan(item.id);
              }}
            >
              {t(MODERATION_I18N_KEYS.dlqRescan)}
            </GatedButton>
            <Button
              size="small"
              type="link"
              data-testid={`${testId}-toggle-${item.id}`}
              data-analytics="none"
              data-analytics-reason="local-ui-reveal-the-server's-own-error-text"
              onClick={() => {
                setOpenError(expanded ? null : item.id);
              }}
            >
              {t(
                expanded
                  ? MODERATION_I18N_KEYS.dlqHideError
                  : MODERATION_I18N_KEYS.dlqShowError
              )}
            </Button>
            <Button
              size="small"
              type="link"
              data-testid={`${testId}-open-${item.id}`}
              data-analytics="none"
              data-analytics-reason="opens the case card; the writes inside it step the tracked moderation.triage flow"
              onClick={() => {
                setOpenCaseId(item.id);
              }}
            >
              {t(MODERATION_I18N_KEYS.queueOpenCase)}
            </Button>
          </Flex>
          {expanded ? (
            // The backend's own message, verbatim and truncated by IT, not by
            // this screen: an engineer reading a dead letter needs the string
            // that was raised, not a paraphrase of it.
            <Typography.Text code data-testid={`${testId}-error-${item.id}`}>
              {item.last_error !== undefined && item.last_error !== ""
                ? item.last_error
                : t(MODERATION_I18N_KEYS.unknownValue)}
            </Typography.Text>
          ) : null}
        </Flex>
      </List.Item>
    );
  }

  function group(entry: DlqGroup): ReactElement {
    const named = entry.errorClass !== "";
    return (
      <Card
        key={entry.errorClass}
        size="small"
        data-testid={`${testId}-group-${named ? entry.errorClass : "unrecorded"}`}
        title={
          <Flex gap={spacing["2"]} align="center" wrap>
            {/* The class is a Python exception NAME from a closed vocabulary,
                not prose — it is shown as it is, because it is the string an
                engineer greps the logs for. */}
            <Tag color="error">
              {named ? entry.errorClass : t(MODERATION_I18N_KEYS.dlqUnknownClass)}
            </Tag>
            <Typography.Text type="secondary">
              {tPlural(MODERATION_I18N_KEYS.dlqGroupCount, { count: entry.count })}
            </Typography.Text>
          </Flex>
        }
      >
        <List
          size="small"
          dataSource={[...entry.rows]}
          rowKey={(item: Case) => item.id}
          data-testid={`${testId}-rows-${named ? entry.errorClass : "unrecorded"}`}
          renderItem={row}
        />
      </Card>
    );
  }

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <div data-testid={testId}>
        <Flex vertical gap={spacing["4"]}>
          <Flex vertical gap={spacing["1"]}>
            <Typography.Title level={4} style={{ margin: spacing["0"] }}>
              {t(MODERATION_I18N_KEYS.dlqLabel)}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t(MODERATION_I18N_KEYS.dlqSubtitle)}
            </Typography.Text>
          </Flex>

          <Typography.Text type="secondary" data-testid={`${testId}-explain`}>
            {t(MODERATION_I18N_KEYS.dlqExplain)}
          </Typography.Text>

          <Flex gap={spacing["3"]} wrap align="flex-end">
            <Flex vertical gap={spacing["1"]} style={{ minWidth: 0 }}>
              <Typography.Text type="secondary">
                {t(MODERATION_I18N_KEYS.dlqFilterErrorClass)}
              </Typography.Text>
              <Select
                value={bag.errorClass ?? ANY}
                style={{ minWidth: "12rem" }}
                aria-label={t(MODERATION_I18N_KEYS.dlqFilterErrorClass)}
                data-testid={`${testId}-filter-class`}
                options={classOptions}
                onChange={(value: string) => {
                  bag.setErrorClass(value !== ANY ? value : undefined);
                }}
              />
            </Flex>
            <GatedButton
              gate={bag.rescanAll}
              type="primary"
              testId={`${testId}-rescan-all`}
              data-analytics="flow"
              onClick={bag.runRescanAll}
            >
              {t(MODERATION_I18N_KEYS.dlqRescanAll)}
            </GatedButton>
            {progressLine()}
          </Flex>

          {refusal !== undefined ? (
            namedRefusal !== undefined ? (
              <ErrorAlert testId={`${testId}-refused`} message={t(namedRefusal)} />
            ) : (
              <ErrorAlert testId={`${testId}-refused`} error={describe(refusal)} />
            )
          ) : null}

          <LoadList
            state={bag.rows}
            testId={testId}
            skeletonRows={3}
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
              // The GOOD empty of this screen, and the only one in the console
              // that is good news about the machines rather than about people.
              <EmptyState
                testId={`${testId}-empty`}
                title={t(MODERATION_I18N_KEYS.dlqEmpty)}
                hint={t(MODERATION_I18N_KEYS.dlqEmptyHint)}
              />
            }
          >
            {() => (
              <Flex vertical gap={spacing["4"]} data-testid={`${testId}-groups`}>
                {bag.groups.map(group)}
                {bag.hasMore ? (
                  <GatedButton
                    gate={bag.loadMore}
                    testId={`${testId}-more`}
                    data-analytics="none"
                    data-analytics-reason="pagination — the same list, one keyset page further"
                    onClick={bag.runLoadMore}
                  >
                    {t(MODERATION_I18N_KEYS.dlqLoadMore)}
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
