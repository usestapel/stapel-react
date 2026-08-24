/**
 * `<DsarQueue>` — the staff triage table for data-subject requests.
 *
 * FOUR arms from `matchList` plus one the ordinary list shapes do not have:
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
import { useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Select,
  Skeleton,
  Table,
  Tag,
  Typography,
} from "antd";
import { matchList, useDescribeFlowError, useI18n, useT } from "@stapel/core";
import type { DsarState, DsarStatus } from "../../api/types.js";
import { toFlowError } from "../../flows/errors.js";
import { GDPR_I18N_KEYS } from "../../i18n/keys.js";
import { formatInstant } from "../../model/dates.js";
import { useDsarQueue, useUpdateDsar } from "../../model/dsar.js";
import { isStaffOnly } from "../../model/refusals.js";
import { ErrorAlert } from "../ErrorAlert.js";
import { GdprSkinTheme } from "../theme.js";
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
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const bag = useDsarQueue();
  const update = useUpdateDsar();
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

  const ackOverdue = new Set(bag.ackOverdue.map((row) => row.request_id));
  const resolveOverdue = new Set(bag.resolveOverdue.map((row) => row.request_id));

  const columns = [
    {
      key: "reference",
      title: t(GDPR_I18N_KEYS.queueColumnReference),
      render: (_: unknown, row: DsarStatus): number => row.request_id,
    },
    {
      key: "kind",
      title: t(GDPR_I18N_KEYS.queueColumnKind),
      render: (_: unknown, row: DsarStatus): string => t(kindKeyFor(row.kind)),
    },
    {
      key: "channel",
      title: t(GDPR_I18N_KEYS.queueColumnChannel),
      render: (_: unknown, row: DsarStatus): string =>
        t(channelKeyFor(row.channel)),
    },
    {
      key: "subject",
      title: t(GDPR_I18N_KEYS.queueColumnSubject),
      render: (_: unknown, row: DsarStatus): string => row.subject_email,
    },
    {
      key: "state",
      title: t(GDPR_I18N_KEYS.queueColumnState),
      render: (_: unknown, row: DsarStatus): ReactElement => (
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
      render: (_: unknown, row: DsarStatus): ReactElement => {
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
          <Flex vertical>
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
      render: (_: unknown, row: DsarStatus): ReactElement => (
        <Flex vertical>
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
      render: (_: unknown, row: DsarStatus): ReactElement => {
        const saved = row.note ?? "";
        const draft = noteDraft[row.request_id] ?? saved;
        // The draft starts life EQUAL to the stored note, so an always-enabled
        // save is a PATCH that writes the value already on the row — a triage
        // edit in the audit trail that edited nothing.
        const unchanged = draft === saved;
        return (
          <Flex gap={4}>
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
    <GdprSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        data-testid="gdpr-queue"
        title={t(GDPR_I18N_KEYS.queueHeading)}
        size="small"
      >
        {matchList(bag.rows, {
          loading: () => (
            <div data-testid="gdpr-queue-loading">
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ),
          failed: (error) =>
            isStaffOnly(error) ? (
              <Alert
                type="info"
                showIcon
                data-testid="gdpr-queue-staff-only"
                message={t(GDPR_I18N_KEYS.staffOnly)}
              />
            ) : (
              <ErrorAlert
                testId="gdpr-queue-failed"
                error={describe(toFlowError(error))}
                action={
                  <Button
                    size="small"
                    onClick={bag.refetch}
                    data-analytics="none"
                    data-analytics-reason="recovery affordance for a failed read — host app wraps with its own tracked()"
                  >
                    {t(GDPR_I18N_KEYS.retry)}
                  </Button>
                }
              />
            ),
          empty: () => (
            <Empty
              data-testid="gdpr-queue-empty"
              description={t(GDPR_I18N_KEYS.queueEmpty)}
            />
          ),
          ready: (rows) => (
            <Flex vertical gap={8}>
              {bag.ackOverdue.length > 0 ? (
                <Alert
                  type="error"
                  showIcon
                  data-testid="gdpr-queue-ack-overdue"
                  message={t(GDPR_I18N_KEYS.queueOverdue)}
                  description={t(GDPR_I18N_KEYS.queueAckMissing)}
                />
              ) : null}
              <Table
                data-testid="gdpr-queue-rows"
                size="small"
                rowKey={(row: DsarStatus) => row.request_id}
                dataSource={[...rows]}
                columns={columns}
                pagination={false}
                scroll={{ x: true }}
              />
            </Flex>
          ),
        })}
      </Card>
    </GdprSkinTheme>
  );
}
