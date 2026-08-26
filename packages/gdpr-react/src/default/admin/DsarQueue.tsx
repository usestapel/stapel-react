/**
 * `<DsarQueue>` — the staff triage table for data-subject requests.
 *
 * FOUR arms from the substrate's `LoadList` plus one no ordinary list has:
 * the **staff refusal**. `GET /dsar` is `AllowAny` at the view level (the POST
 * beside it must accept an anonymous form), so its staff check is hand-rolled
 * in the handler and comes back as a generic `error.403.forbidden`. Rendered
 * as a plain failure it would show an operations-table error to somebody who
 * is simply signed in with the wrong account, so `isStaffOnly` names it and
 * the screen says so.
 *
 * ── Two deadlines, and the one that means the machine broke ───────────────
 *
 * `ack_due_at` is three BUSINESS days and the acknowledgement is AUTOMATED —
 * creating a request sends it and stamps `ack_sent_at`. So a row past its ack
 * deadline with no `ack_sent_at` does not mean an operator was slow; it means
 * the notification wiring is broken. That is the same finding `gdpr.W008`
 * raises at boot, and here it is on the screen where somebody can act on it.
 * `resolve_due_at` (30 days) is the ordinary one: it is on a person.
 *
 * ── Matching a request to an account is the consequential control ─────────
 *
 * Setting `user_id` is the moment the machine that ANSWERS the request starts
 * — an erasure becomes the cancellable closure, an access request becomes a
 * data export. Intake deliberately refuses to do it (an unverified email
 * turned into a deletion is an oracle), so it is a staff act, and it is the
 * one field here that is typed rather than picked.
 */
import { useId, useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Card, Flex, Input, Select, Tag, Typography } from "antd";
import { fontSize, spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { useI18n, useT, useTPlural } from "@stapel/core";
import type { DsarState, DsarStatus } from "../../api/types.js";
import { GDPR_I18N_KEYS } from "../../i18n/keys.js";
import { formatInstant } from "../../model/dates.js";
import { useDsarQueue, useUpdateDsar } from "../../model/dsar.js";
import { isStaffOnly } from "../../model/refusals.js";
import { DataTable } from "../DataTable.js";
import type { DataColumn } from "../DataTable.js";
import type { ThemeModeProp } from "../types.js";

export type DsarQueueProps = ThemeModeProp;

const STATES: readonly { readonly value: DsarState; readonly labelKey: string }[] = [
  { value: "received", labelKey: GDPR_I18N_KEYS.queueStateReceived },
  { value: "acknowledged", labelKey: GDPR_I18N_KEYS.queueStateAcknowledged },
  { value: "in_progress", labelKey: GDPR_I18N_KEYS.queueStateInProgress },
  { value: "resolved", labelKey: GDPR_I18N_KEYS.queueStateResolved },
  { value: "rejected", labelKey: GDPR_I18N_KEYS.queueStateRejected },
];

function kindKeyFor(kind: string): string {
  switch (kind) {
    case "erasure":
      return GDPR_I18N_KEYS.dsarKindErasure;
    case "rectification":
      return GDPR_I18N_KEYS.dsarKindRectification;
    case "portability":
      return GDPR_I18N_KEYS.dsarKindPortability;
    default:
      return GDPR_I18N_KEYS.dsarKindAccess;
  }
}

function channelKeyFor(channel: string): string {
  switch (channel) {
    case "form":
      return GDPR_I18N_KEYS.queueChannelForm;
    case "email":
      return GDPR_I18N_KEYS.queueChannelEmail;
    default:
      return GDPR_I18N_KEYS.queueChannelApp;
  }
}

export function DsarQueue(props: DsarQueueProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const bag = useDsarQueue();
  const update = useUpdateDsar();
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const noteRuleId = useId();

  const ackOverdue = new Set(bag.ackOverdue.map((row) => row.request_id));
  const resolveOverdue = new Set(bag.resolveOverdue.map((row) => row.request_id));

  const columns: readonly DataColumn<DsarStatus>[] = [
    {
      key: "request",
      // What a request IS, with its reference underneath. `6` was the title of
      // a row about somebody's deletion request: a queue identified by
      // primary keys reads as a database, and the reference is what an
      // operator quotes back, not what they recognise the row by.
      title: t(GDPR_I18N_KEYS.queueColumnKind),
      primary: true,
      render: (row: DsarStatus): ReactElement => (
        <Flex vertical>
          <Typography.Text>{t(kindKeyFor(row.kind))}</Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ fontSize: fontSize.xs.fontSize }}
          >
            {t(GDPR_I18N_KEYS.queueReference, { reference: row.request_id })}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: "channel",
      title: t(GDPR_I18N_KEYS.queueColumnChannel),
      render: (row: DsarStatus): string => t(channelKeyFor(row.channel)),
    },
    {
      key: "subject",
      title: t(GDPR_I18N_KEYS.queueColumnSubject),
      render: (row: DsarStatus): string => row.subject_email,
    },
    {
      key: "state",
      title: t(GDPR_I18N_KEYS.queueColumnState),
      render: (row: DsarStatus): ReactElement => (
        <Select
          size="small"
          value={row.state as DsarState}
          style={{ minWidth: "9rem" }}
          aria-label={t(GDPR_I18N_KEYS.queueColumnState)}
          onChange={(next: DsarState) =>
            update.mutate({ dsarId: row.request_id, state: next })
          }
          options={STATES.map((entry) => ({
            value: entry.value,
            label: t(entry.labelKey),
          }))}
          data-analytics="none"
          data-analytics-reason="staff triage write — host app wraps with its own tracked()"
        />
      ),
    },
    {
      key: "ack",
      title: t(GDPR_I18N_KEYS.queueColumnAckDue),
      render: (row: DsarStatus): ReactElement => {
        // Acknowledged is the good case and it carries its OWN date, because
        // "acknowledged" without one is unauditable.
        if (row.ack_sent_at != null) {
          return (
            <Typography.Text type="secondary">
              {t(GDPR_I18N_KEYS.queueAckSent, {
                date: formatInstant(row.ack_sent_at, locale),
              })}
            </Typography.Text>
          );
        }
        const late = ackOverdue.has(row.request_id);
        return (
          <Flex vertical align="flex-start">
            <Typography.Text>{formatInstant(row.ack_due_at, locale)}</Typography.Text>
            <Tag color={late ? "red" : "orange"}>
              {t(late ? GDPR_I18N_KEYS.queueOverdue : GDPR_I18N_KEYS.queueAckMissing)}
            </Tag>
          </Flex>
        );
      },
    },
    {
      key: "resolve",
      title: t(GDPR_I18N_KEYS.queueColumnResolveDue),
      render: (row: DsarStatus): ReactElement => (
        <Flex vertical align="flex-start">
          <Typography.Text>
            {formatInstant(row.resolve_due_at, locale)}
          </Typography.Text>
          {resolveOverdue.has(row.request_id) ? (
            <Tag color="red">{t(GDPR_I18N_KEYS.queueOverdue)}</Tag>
          ) : null}
        </Flex>
      ),
    },
    {
      key: "note",
      title: t(GDPR_I18N_KEYS.dsarNoteLabel),
      render: (row: DsarStatus): ReactElement => {
        const saved = row.note ?? "";
        const draft = noteDraft[row.request_id] ?? saved;
        // The draft starts life EQUAL to the stored note, so an always-enabled
        // save is a PATCH that writes the value already on the row — a triage
        // edit in the audit trail that edited nothing.
        const unchanged = draft === saved;
        // The reason lives ONCE, under the table, and every switched-off save
        // points at it through `aria-describedby`. `GatedButton` renders the
        // sentence beside the control — correct for a control that appears
        // once on a screen, and a wall of identical apology when the control
        // appears once per row: every row of this queue printed "No change to
        // save" under its own button. Same rule, said once, still read aloud
        // with the control by a screen reader.
        return (
          <Flex gap={spacing[1]}>
            <Input
              size="small"
              aria-label={t(GDPR_I18N_KEYS.dsarNoteLabel)}
              value={draft}
              onChange={(event) =>
                setNoteDraft((current) => ({
                  ...current,
                  [row.request_id]: event.target.value,
                }))
              }
            />
            <Button
              size="small"
              disabled={unchanged}
              // The rule's own escape hatch: the reason IS on the page beside
              // the control — once, under the table, with `aria-describedby`
              // pointing every switched-off save at it.
              data-disabled-reason="the note is unchanged; the rule is stated once under the table and wired to every save through aria-describedby"
              {...(unchanged ? { "aria-describedby": noteRuleId } : {})}
              data-analytics="none"
              data-analytics-reason="staff triage write — host app wraps with its own tracked()"
              onClick={() =>
                update.mutate({ dsarId: row.request_id, note: draft })
              }
            >
              {t(GDPR_I18N_KEYS.queueSaveNote)}
            </Button>
          </Flex>
        );
      },
    },
  ];

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        data-testid="gdpr-queue"
        title={t(GDPR_I18N_KEYS.queueHeading)}
        size="small"
      >
        <LoadList
          state={bag.rows}
          testId="gdpr-queue"
          skeletonRows={3}
          onRetry={bag.refetch}
          // The one arm the substrate cannot design for us: a 403 here is not
          // a fault, it is a person signed in with the wrong account, and the
          // screen says so by NAME rather than showing them an operations
          // failure they cannot act on.
          failed={(error) =>
            isStaffOnly(error) ? (
              <Alert
                type="info"
                showIcon
                data-testid="gdpr-queue-staff-only"
                title={t(GDPR_I18N_KEYS.staffOnly)}
              />
            ) : (
              <ErrorAlert
                testId="gdpr-queue-failed"
                thrown={error}
                onRetry={bag.refetch}
              />
            )
          }
          empty={
            <EmptyState
              testId="gdpr-queue-empty"
              title={t(GDPR_I18N_KEYS.queueEmpty)}
            />
          }
        >
          {(rows) => (
            <Flex vertical gap={spacing[2]}>
              {bag.ackOverdue.length > 0 ? (
                <Alert
                  type="error"
                  showIcon
                  data-testid="gdpr-queue-ack-overdue"
                  // The count, then the FINDING. "Overdue / Not acknowledged"
                  // repeated the two tags already on the rows and told an
                  // operator nothing they could act on; the acknowledgement is
                  // automated, so a missed one is broken wiring, not a slow
                  // person.
                  title={tPlural(GDPR_I18N_KEYS.queueAckOverdueCount, {
                    count: bag.ackOverdue.length,
                  })}
                  description={t(GDPR_I18N_KEYS.queueAckAutomated)}
                />
              ) : null}
              <DataTable
                testId="gdpr-queue-rows"
                rowKey={(row: DsarStatus) => row.request_id}
                rows={rows}
                columns={columns}
              />
              <Typography.Text
                id={noteRuleId}
                type="secondary"
                style={{ fontSize: fontSize.xs.fontSize }}
                data-testid="gdpr-queue-note-rule"
              >
                {t(GDPR_I18N_KEYS.queueNoteUnchanged)}
              </Typography.Text>
            </Flex>
          )}
        </LoadList>
      </Card>
    </SkinTheme>
  );
}
