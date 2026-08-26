/**
 * `<PendingDeletions>` — everything of this person's that is on its way out.
 *
 * FOUR arms from the substrate's `LoadList`, and the empty one is the point: "nothing of
 * yours is waiting to be deleted" is only sayable from a load that actually
 * succeeded. A table that drew zero rows on a failed read would tell somebody
 * their deletion request never existed.
 *
 * ── Two columns, because there are two clocks ─────────────────────────────
 *
 * `due_at` is when OUR systems must be done with it. `fully_erased_by` is
 * that stretched to the last subprocessor's contractual window — the module
 * computes it as `max(due_at, max(obligation.due_at))`, which is why a
 * recording can be gone from us on the 23rd and gone from everywhere on the
 * 18th of the following month. Showing only the first date would be a
 * comfortable lie; showing only the second would be a needlessly frightening
 * one. Both, labelled, with the difference explained once — as TEXT under the
 * table, not as a tooltip on the column header: a hover-only explanation of
 * the one column nobody can guess the meaning of does not exist on a phone.
 *
 * ── `timeout` is a row a person can see ───────────────────────────────────
 *
 * When an owner never receipts, the module marks the request `timeout` rather
 * than quietly leaving it `queued` forever. The table renders that as its own
 * state with an explanation that somebody has been alerted — the alternative
 * (a green tick, or a row that simply never changes) is how a deletion gets
 * forgotten. That explanation, and the list of owners a queued request is
 * still waiting on, are printed under the tag for the same reason as above.
 */
import type { ReactElement } from "react";
import { Alert, Card, Flex, Tag, Typography } from "antd";
import { fontSize, spacing } from "@stapel/tokens";
import {
  EmptyState,
  LoadBoundary,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { useI18n, useT, useTPlural } from "@stapel/core";
import type { ErasurePart, ErasureStatus, SubprocessorObligation } from "../api/types.js";
import { GDPR_I18N_KEYS } from "../i18n/keys.js";
import { formatDeletionDate, formatInstant } from "../model/dates.js";
import { useErasure, useMyErasures } from "../model/erasures.js";
import { DataTable } from "./DataTable.js";
import type { DataColumn } from "./DataTable.js";
import type { ThemeModeProp } from "./types.js";

export interface PendingDeletionsProps extends ThemeModeProp {
  /**
   * Turn a `(subject_type, subject_key)` pair into something a person
   * recognises — "your 12 August stand-up recording", not `9f1c2d3e`.
   *
   * The wire carries the host's own opaque id and nothing else: stapel-gdpr
   * deliberately keeps no copy of the subject's title, because holding one
   * would mean holding the very data the erasure is deleting.
   *
   * Returning `undefined` is the honest answer for a subject the host cannot
   * name — a recording it has already deleted, an id from another tenant —
   * and it is a DIFFERENT answer from returning the key: the row then reads
   * "Workspace / Ref ws-42", the kind of thing on the first line and the
   * reference underneath, rather than presenting a hex string as the name of
   * the thing being deleted. Dropping the row would be worse than either.
   */
  readonly labelFor?: (
    subjectType: string,
    subjectKey: string
  ) => string | undefined;
}

/** The i18n key for a known subject type, or `undefined` for a host's own. */
function subjectKeyFor(subjectType: string): string | undefined {
  switch (subjectType) {
    case "account":
      return GDPR_I18N_KEYS.subjectAccount;
    case "workspace":
      return GDPR_I18N_KEYS.subjectWorkspace;
    case "meeting":
      return GDPR_I18N_KEYS.subjectMeeting;
    case "recording":
      return GDPR_I18N_KEYS.subjectRecording;
    case "document":
      return GDPR_I18N_KEYS.subjectDocument;
    case "file":
      return GDPR_I18N_KEYS.subjectFile;
    default:
      // `SUBJECT_TYPES` is host-extensible. An unknown one renders its own raw
      // name rather than a wrong translation or a blank cell.
      return undefined;
  }
}

function stateKeyFor(state: string): string {
  switch (state) {
    case "erasing":
      return GDPR_I18N_KEYS.deletionsStateErasing;
    case "deleted":
      return GDPR_I18N_KEYS.deletionsStateDeleted;
    case "timeout":
      return GDPR_I18N_KEYS.deletionsStateTimeout;
    default:
      return GDPR_I18N_KEYS.deletionsStateQueued;
  }
}

function stateColor(state: string): string | undefined {
  switch (state) {
    case "deleted":
      return "green";
    case "timeout":
      return "red";
    case "erasing":
      return "blue";
    default:
      return undefined;
  }
}

export function PendingDeletions(props: PendingDeletionsProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const bag = useMyErasures();
  const { labelFor } = props;

  // Is the "an owner never confirmed" explanation already stated ONCE, as the
  // banner above the table? Then the rows do not repeat it: the same sentence
  // under every affected row is the disabled-reason wall in another costume —
  // three rows became a wall of identical apology on one 390px screen. The tag
  // still names the state per row, which is what a row has to do.
  const timeoutExplained = bag.overdue.length > 0;

  const columns: readonly DataColumn<ErasureStatus>[] = [
    {
      key: "subject",
      title: t(GDPR_I18N_KEYS.deletionsColumnSubject),
      primary: true,
      render: (row: ErasureStatus): ReactElement => {
        const typeKey = subjectKeyFor(row.subject_type);
        const type = typeKey !== undefined ? t(typeKey) : row.subject_type;
        const label = labelFor?.(row.subject_type, row.subject_key);
        // The host's opaque key is a REFERENCE, never a title. With a resolver
        // the row is "Stand-up, 12 August / Recording"; without one it is
        // "Recording / ws-42" — the kind a person recognises on the first
        // line and the id underneath it, rather than a hex string as the name
        // of the thing being deleted.
        return (
          <Flex vertical>
            <Typography.Text>{label ?? type}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
              {label !== undefined
                ? type
                : t(GDPR_I18N_KEYS.deletionsReference, { reference: row.subject_key })}
            </Typography.Text>
          </Flex>
        );
      },
    },
    {
      key: "state",
      title: t(GDPR_I18N_KEYS.deletionsColumnState),
      render: (row: ErasureStatus): ReactElement => {
        const color = stateColor(row.state);
        const waiting = row.unreceipted_owners ?? [];
        // What the state MEANS is the whole reason this column exists, so it
        // is printed under the tag rather than hidden behind a hover: on a
        // phone there is no hover, and a bare "Overdue" on a screen about
        // one's own deletion request explains nothing. Said once above, it is
        // not said again here.
        const hint =
          row.state === "timeout"
            ? timeoutExplained
              ? undefined
              : t(GDPR_I18N_KEYS.deletionsTimeoutHint)
            : waiting.length > 0
              ? t(GDPR_I18N_KEYS.deletionsWaitingOn, { owners: waiting.join(", ") })
              : undefined;
        return (
          <Flex vertical gap={spacing[1]} align="flex-start">
            <Tag {...(color !== undefined ? { color } : {})}>
              {t(stateKeyFor(row.state))}
            </Tag>
            {hint !== undefined ? (
              <Typography.Text
                type="secondary"
                style={{ fontSize: fontSize.xs.fontSize }}
                data-testid="gdpr-deletions-state-hint"
              >
                {hint}
              </Typography.Text>
            ) : null}
          </Flex>
        );
      },
    },
    {
      key: "due",
      title: t(GDPR_I18N_KEYS.deletionsColumnDue),
      render: (row: ErasureStatus): string =>
        formatDeletionDate(row.due_at, locale),
    },
    {
      key: "fully",
      // The header is a plain label; what the second clock means is said
      // under the table, in text, where it can be read without a pointer.
      title: t(GDPR_I18N_KEYS.deletionsColumnFullyErased),
      render: (row: ErasureStatus): string =>
        formatDeletionDate(row.fully_erased_by, locale),
    },
  ];

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        data-testid="gdpr-deletions"
        title={t(GDPR_I18N_KEYS.deletionsHeading)}
        size="small"
      >
        <LoadList
          state={bag.rows}
          testId="gdpr-deletions"
          skeletonRows={2}
          onRetry={bag.refetch}
          empty={
            <EmptyState
              testId="gdpr-deletions-empty"
              title={t(GDPR_I18N_KEYS.deletionsEmpty)}
            />
          }
        >
          {(rows) => (
            <Flex vertical gap={spacing[2]}>
              {bag.overdue.length > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  data-testid="gdpr-deletions-overdue"
                  title={tPlural(GDPR_I18N_KEYS.deletionsOverdueCount, {
                    count: bag.overdue.length,
                  })}
                  description={t(GDPR_I18N_KEYS.deletionsTimeoutHint)}
                />
              ) : null}
              <DataTable
                testId="gdpr-deletions-rows"
                rowKey={(row: ErasureStatus) => row.request_id}
                rows={rows}
                columns={columns}
                // Opening a row is what answers "why is this STILL here?" —
                // the per-owner receipts and the processor windows that push
                // the second date out. The detail read (`GET /erasures/{id}`)
                // is issued only for the row a person actually opened.
                expand={{
                  label: t(GDPR_I18N_KEYS.deletionsExpand),
                  render: (row: ErasureStatus) => (
                    <ErasureDetail requestId={row.request_id} />
                  ),
                }}
              />
              <Typography.Text
                type="secondary"
                style={{ fontSize: fontSize.xs.fontSize }}
                data-testid="gdpr-deletions-fully-erased-hint"
              >
                {t(GDPR_I18N_KEYS.deletionsFullyErasedHint)}
              </Typography.Text>
            </Flex>
          )}
        </LoadList>
      </Card>
    </SkinTheme>
  );
}

/**
 * An `ErasurePart`'s tag colour — antd's semantic PRESET names, resolved by
 * the theme algorithm, which is why the mapping lives beside the label mapping
 * (as `stateColor` does for the row) instead of inline in the cell: a state's
 * label and its colour are one decision and change together.
 */
function partStateColor(state: string): string | undefined {
  switch (state) {
    case "done":
      return "green";
    case "timeout":
      return "red";
    default:
      return undefined;
  }
}

/** The i18n key for an `ErasurePart`'s own state. */
function partStateKeyFor(state: string): string {
  switch (state) {
    case "done":
      return GDPR_I18N_KEYS.deletionsPartDone;
    case "timeout":
      return GDPR_I18N_KEYS.deletionsPartTimeout;
    default:
      return GDPR_I18N_KEYS.deletionsPartPending;
  }
}

/** One part's state as a tag — the colour comes from {@link partStateColor}. */
function PartStateTag(props: { state: string }): ReactElement {
  const t = useT();
  const color = partStateColor(props.state);
  return (
    <Tag {...(color !== undefined ? { color } : {})}>
      {t(partStateKeyFor(props.state))}
    </Tag>
  );
}

/**
 * One erasure, opened: which system has confirmed, and which processor window
 * is still open.
 *
 * This is the only screen in the pair that reads a SINGLE erasure
 * (`GET /erasures/{id}`), and it exists because the row above it cannot answer
 * the question the row provokes. "Being erased, ours by 23 September,
 * everywhere by 18 October" is true and says nothing about WHO is holding it
 * up — the receipts do, and a person entitled to the deletion is entitled to
 * the receipts. It is mounted only when the row is expanded, so the read is
 * one request per opened row rather than one per listed row.
 */
function ErasureDetail(props: { requestId: number }): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const bag = useErasure(props.requestId);
  return (
    <LoadBoundary
      state={bag.state}
      testId="gdpr-deletions-detail"
      skeletonRows={2}
      onRetry={bag.refetch}
    >
      {(erasure) => {
        // Both are optional on the wire: an erasure opened this second has no
        // part rows yet, and a subject nobody passed to a processor has no
        // obligations at all. Neither absence is an error, and neither is the
        // same thing as "nothing holds it".
        const parts = erasure.parts ?? [];
        const obligations = erasure.obligations ?? [];
        return (
        <Flex vertical gap={spacing[2]} data-testid="gdpr-deletions-detail">
          <Typography.Text strong>
            {t(GDPR_I18N_KEYS.deletionsPartsHeading)}
          </Typography.Text>
          {parts.length === 0 ? (
            <Typography.Text type="secondary">
              {t(GDPR_I18N_KEYS.deletionsPartsEmpty)}
            </Typography.Text>
          ) : (
            parts.map((part: ErasurePart) => (
              <Flex key={part.owner} gap={spacing[2]} align="baseline" wrap>
                <Typography.Text>{part.owner}</Typography.Text>
                <PartStateTag state={part.state} />
                {/* A receipt without its instant is unauditable — it is the
                    proof a person is being handed. */}
                {part.receipt_at != null ? (
                  <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
                    {t(GDPR_I18N_KEYS.deletionsPartReceipt, {
                      date: formatInstant(part.receipt_at, locale),
                    })}
                  </Typography.Text>
                ) : null}
              </Flex>
            ))
          )}
          {/* The processors are WHY the second clock is later than the first,
              named one by one rather than left as a difference of dates. */}
          {obligations.length > 0 ? (
            <>
              <Typography.Text strong>
                {t(GDPR_I18N_KEYS.deletionsObligationsHeading)}
              </Typography.Text>
              {obligations.map((duty: SubprocessorObligation) => (
                <Typography.Text
                  key={duty.provider}
                  type="secondary"
                  data-testid="gdpr-deletions-obligation"
                >
                  {t(GDPR_I18N_KEYS.deletionsObligation, {
                    provider: duty.provider,
                    date: formatDeletionDate(duty.due_at, locale),
                  })}
                </Typography.Text>
              ))}
            </>
          ) : null}
        </Flex>
        );
      }}
    </LoadBoundary>
  );
}
