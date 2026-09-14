/**
 * `<IssueDetail>` — one bug, everything the store knows about it, and the
 * three judgements an operator can record.
 *
 * ── The events are a SAMPLE, and the screen says so ───────────────────────
 *
 * The detail carries the last 20 occurrences; `count` carries all of them, and
 * retention sweeps events long before it would touch an open issue. A list of
 * twenty with a count of forty thousand beside it is not a contradiction and
 * must not read as one, so the heading states the relationship in words.
 *
 * ── The traceback is behind an expander, not in the page ──────────────────
 *
 * A Django traceback is routinely sixty frames. Three of them inline and every
 * control on this screen is below the fold, which on the screen somebody opened
 * to CLOSE a bug is the whole point missed. Each occurrence is a collapsed row
 * carrying its own trace and its own context.
 *
 * ── `regressed` is reported, never offered ───────────────────────────────
 *
 * The store sets it when a fixed issue receives a new event. The notice names
 * the release that was supposed to have stopped it, because that — and not the
 * status word — is what somebody needs in order to act.
 *
 * ── Three refusals, three sentences ───────────────────────────────────────
 *
 * 403 is "wrong account", 401 is "sign in again", 404 is "no such issue, and
 * here is why that can happen": a closed issue with no events left IS swept,
 * while an open one never is. Anything else is a read failure with a retry.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Card, Collapse, Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  LoadBoundary,
  Page,
  SkinButton,
  SkinConfirm,
  StatusTag,
} from "@stapel/tokens-antd/skin";
import { useFormat, useT } from "@stapel/core";
import type { ErrorEvent, IssueDetail as IssueDetailRow } from "../api/types.js";
import { useIssue } from "../model/issues.js";
import { useIssueStatus } from "../model/status.js";
import {
  isAlertsStaffOnly,
  isAlertsUnauthorized,
  isIssueNotFound,
} from "../model/refusals.js";
import { useAlertsRuntime } from "../model/context.js";
import { ALERTS_I18N_KEYS } from "../i18n/keys.js";
import { FixIssueDialog } from "./FixIssueDialog.js";
import { MuteIssueDialog } from "./MuteIssueDialog.js";
import { kindKey, levelFamily, levelKey, statusFamily, statusKey } from "./labels.js";
import { TRACE_BLOCK_STYLE } from "./layout.js";
import type { ThemeModeProp } from "./types.js";

export interface IssueDetailProps extends ThemeModeProp {
  readonly issueId: string;
  /** The way back to the feed, if the host has one. */
  readonly onBack?: () => void;
  readonly testId?: string;
}

/** One label/value pair of the meta block. Absent values render the dash. */
function Field(props: {
  label: string;
  children: ReactNode;
  testId?: string;
}): ReactElement {
  return (
    <Flex vertical style={{ minWidth: "12rem" }} data-testid={props.testId}>
      <Typography.Text type="secondary">{props.label}</Typography.Text>
      <Typography.Text>{props.children}</Typography.Text>
    </Flex>
  );
}

export function IssueDetail(props: IssueDetailProps): ReactElement {
  const t = useT();
  const fmt = useFormat();
  const runtime = useAlertsRuntime();
  const testId = props.testId ?? "alerts-issue";
  const bag = useIssue(props.issueId);
  const { reopen } = useIssueStatus();
  const [fixing, setFixing] = useState(false);
  const [muting, setMuting] = useState(false);
  const [reopening, setReopening] = useState(false);

  const absent = t(ALERTS_I18N_KEYS.none);
  const text = (value: string): string => (value.length > 0 ? value : absent);

  const meta = (issue: IssueDetailRow): ReactElement => (
    <Card size="small" data-testid={`${testId}-meta`}>
      <Flex gap={spacing[4]} wrap>
        <Field label={t(ALERTS_I18N_KEYS.detailService)}>{issue.service}</Field>
        <Field label={t(ALERTS_I18N_KEYS.detailEnvironment)}>
          {text(issue.environment)}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailKind)}>
          {t(kindKey(issue.kind), { kind: issue.kind })}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailCount)} testId={`${testId}-count`}>
          {String(issue.count)}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailSinceFix)}>
          {String(issue.count_since_fix)}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailFirstSeen)}>
          {fmt.timestamp(issue.first_seen) ?? absent}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailLastSeen)}>
          {fmt.timestamp(issue.last_seen) ?? absent}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailFingerprint)}>
          {text(issue.fingerprint)}
        </Field>
        {issue.fixed_in_version.length > 0 ? (
          <Field
            label={t(ALERTS_I18N_KEYS.detailFixedIn)}
            testId={`${testId}-fixed-version`}
          >
            {issue.fixed_in_version}
          </Field>
        ) : null}
        {issue.fixed_in_sha.length > 0 ? (
          <Field
            label={t(ALERTS_I18N_KEYS.detailFixedSha)}
            testId={`${testId}-fixed-sha`}
          >
            {runtime.commitRefUrl === undefined ? (
              issue.fixed_in_sha
            ) : (
              <Typography.Link
                href={runtime.commitRefUrl(issue.fixed_in_sha)}
                target="_blank"
                rel="noreferrer"
              >
                {issue.fixed_in_sha}
              </Typography.Link>
            )}
          </Field>
        ) : null}
        {issue.fixed_at !== null ? (
          <Field label={t(ALERTS_I18N_KEYS.detailFixedAt)}>
            {fmt.timestamp(issue.fixed_at) ?? absent}
          </Field>
        ) : null}
        {/* `muted_until` is only meaningful WHILE muted: the store writes the
            field when the mute is set and does not clear it when the status
            moves on (BACKEND-GAP A-4), so a fixed issue can carry last
            month's deadline. Reading it outside the muted status would print
            a mute nobody set. */}
        {issue.status === "muted" ? (
          <Field
            label={t(ALERTS_I18N_KEYS.detailMutedUntil)}
            testId={`${testId}-muted-until`}
          >
            {issue.muted_until === null
              ? t(ALERTS_I18N_KEYS.detailMutedForever)
              : (fmt.timestamp(issue.muted_until) ?? absent)}
          </Field>
        ) : null}
        {issue.sentry_event_id.length > 0 ? (
          <Field label={t(ALERTS_I18N_KEYS.detailSentry)}>
            {issue.sentry_event_id}
          </Field>
        ) : null}
      </Flex>
      {issue.note.length > 0 ? (
        <Flex vertical style={{ marginBlockStart: spacing[3] }}>
          <Typography.Text type="secondary">
            {t(ALERTS_I18N_KEYS.detailNote)}
          </Typography.Text>
          <Typography.Paragraph data-testid={`${testId}-note`}>
            {issue.note}
          </Typography.Paragraph>
        </Flex>
      ) : null}
    </Card>
  );

  const event = (row: ErrorEvent): ReactElement => (
    <Flex vertical gap={spacing[2]}>
      <Flex gap={spacing[4]} wrap>
        <Field label={t(ALERTS_I18N_KEYS.detailReceivedAt)}>
          {fmt.timestamp(row.received_at) ?? absent}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailRelease)}>
          {text(row.release)}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailRequestPath)}>
          {text(row.request_path)}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailTraceId)}>
          {text(row.trace_id)}
        </Field>
        <Field label={t(ALERTS_I18N_KEYS.detailOccurrences)}>
          {String(row.occurrences)}
        </Field>
      </Flex>

      <Typography.Text strong>{t(ALERTS_I18N_KEYS.detailTrace)}</Typography.Text>
      {row.trace.length > 0 ? (
        <pre style={TRACE_BLOCK_STYLE} data-testid={`${testId}-trace-${row.id}`}>
          {row.trace}
        </pre>
      ) : (
        <Typography.Text type="secondary">
          {t(ALERTS_I18N_KEYS.detailNoTrace)}
        </Typography.Text>
      )}

      <Typography.Text strong>{t(ALERTS_I18N_KEYS.detailContext)}</Typography.Text>
      {row.context === null || row.context === undefined ? (
        <Typography.Text type="secondary">
          {t(ALERTS_I18N_KEYS.detailNoContext)}
        </Typography.Text>
      ) : (
        <pre style={TRACE_BLOCK_STYLE} data-testid={`${testId}-context-${row.id}`}>
          {JSON.stringify(row.context, null, 2)}
        </pre>
      )}
      <Typography.Text type="secondary">
        {t(ALERTS_I18N_KEYS.detailRedacted)}
      </Typography.Text>
    </Flex>
  );

  return (
    <Page
      title={t(ALERTS_I18N_KEYS.detailTitle)}
      data-testid={testId}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props.onBack !== undefined
        ? {
            actions: (
              <SkinButton
                size="small"
                data-testid={`${testId}-back`}
                data-analytics="none"
                data-analytics-reason="navigation back to the board decides nothing"
                onClick={props.onBack}
              >
                {t(ALERTS_I18N_KEYS.feedTitle)}
              </SkinButton>
            ),
          }
        : {})}
    >
      <LoadBoundary
        state={bag.state}
        testId={testId}
        onRetry={bag.refetch}
        failed={(error) =>
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
          ) : isIssueNotFound(error) ? (
            <EmptyState
              testId={`${testId}-not-found`}
              title={t(ALERTS_I18N_KEYS.detailNotFound)}
              hint={t(ALERTS_I18N_KEYS.detailNotFoundHint)}
            />
          ) : (
            <ErrorAlert
              testId={`${testId}-failed`}
              thrown={error}
              message={t(ALERTS_I18N_KEYS.detailFailed)}
              onRetry={bag.refetch}
            />
          )
        }
      >
        {(issue) => (
          <Flex vertical gap={spacing[4]}>
            <Flex vertical gap={spacing[2]}>
              <Flex gap={spacing[2]} wrap align="center">
                <StatusTag
                  status={levelFamily(issue.level)}
                  testId={`${testId}-level`}
                >
                  {t(levelKey(issue.level), { level: issue.level })}
                </StatusTag>
                <StatusTag
                  status={statusFamily(issue.status)}
                  testId={`${testId}-status`}
                >
                  {t(statusKey(issue.status), { status: issue.status })}
                </StatusTag>
              </Flex>
              <Typography.Title level={4} data-testid={`${testId}-title`}>
                {issue.title}
              </Typography.Title>
              <Typography.Text type="secondary" data-testid={`${testId}-culprit`}>
                {text(issue.culprit)}
              </Typography.Text>
            </Flex>

            {issue.status === "regressed" ? (
              <ErrorAlert
                testId={`${testId}-regressed`}
                message={t(ALERTS_I18N_KEYS.detailRegressed)}
                detail={t(ALERTS_I18N_KEYS.detailRegressedHint, {
                  version:
                    issue.fixed_in_version.length > 0
                      ? issue.fixed_in_version
                      : absent,
                })}
              />
            ) : null}

            {meta(issue)}

            <Flex gap={spacing[2]} wrap>
              <SkinButton
                type="primary"
                data-testid={`${testId}-mark-fixed`}
                data-analytics="none"
                data-analytics-reason="opens the fix dialog; the event is emitted when the store saves"
                onClick={() => setFixing(true)}
              >
                {t(ALERTS_I18N_KEYS.detailMarkFixed)}
              </SkinButton>
              <SkinButton
                data-testid={`${testId}-mute`}
                data-analytics="none"
                data-analytics-reason="opens the mute dialog; the event is emitted when the store saves"
                onClick={() => setMuting(true)}
              >
                {t(ALERTS_I18N_KEYS.detailMute)}
              </SkinButton>
              {issue.status === "new" ? null : (
                <SkinButton
                  data-testid={`${testId}-reopen`}
                  data-analytics="none"
                  data-analytics-reason="opens a confirm; the event is emitted when the store saves"
                  onClick={() => setReopening(true)}
                >
                  {t(ALERTS_I18N_KEYS.detailReopen)}
                </SkinButton>
              )}
            </Flex>

            <ErrorAlert
              testId={`${testId}-reopen-failed`}
              thrown={reopen.error}
              variant="inline"
            />

            <Card
              size="small"
              title={t(ALERTS_I18N_KEYS.detailEvents)}
              data-testid={`${testId}-events`}
              extra={
                <Typography.Text type="secondary">
                  {t(ALERTS_I18N_KEYS.detailEventsHint, {
                    shown: issue.events.length,
                    count: issue.count,
                  })}
                </Typography.Text>
              }
            >
              {issue.events.length === 0 ? (
                <EmptyState
                  compact
                  testId={`${testId}-events-empty`}
                  title={t(ALERTS_I18N_KEYS.detailEventsEmpty)}
                  hint={t(ALERTS_I18N_KEYS.detailEventsEmptyHint)}
                />
              ) : (
                <Collapse
                  size="small"
                  ghost
                  items={issue.events.map((row) => ({
                    key: row.id,
                    label: `${fmt.relative(row.received_at) ?? absent} · ${text(row.message)}`,
                    children: event(row),
                  }))}
                />
              )}
            </Card>

            <FixIssueDialog
              open={fixing}
              onClose={() => setFixing(false)}
              issueId={issue.id}
              level={issue.level}
              testId={`${testId}-fix`}
              {...(props.mode !== undefined ? { mode: props.mode } : {})}
            />
            <MuteIssueDialog
              open={muting}
              onClose={() => setMuting(false)}
              issueId={issue.id}
              level={issue.level}
              testId={`${testId}-mute-dialog`}
              {...(props.mode !== undefined ? { mode: props.mode } : {})}
            />
            <SkinConfirm
              open={reopening}
              onCancel={() => setReopening(false)}
              onConfirm={() =>
                reopen.mutate(
                  { issueId: issue.id, level: issue.level },
                  { onSuccess: () => setReopening(false) }
                )
              }
              title={t(ALERTS_I18N_KEYS.detailReopen)}
              body={t(ALERTS_I18N_KEYS.detailReopenConfirm)}
              confirmLabel={t(ALERTS_I18N_KEYS.detailReopen)}
              cancelLabel={t(ALERTS_I18N_KEYS.cancel)}
              confirming={reopen.isPending}
              data-testid={`${testId}-reopen-confirm`}
            />
          </Flex>
        )}
      </LoadBoundary>
    </Page>
  );
}
