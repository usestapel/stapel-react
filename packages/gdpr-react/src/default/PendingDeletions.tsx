/**
 * `<PendingDeletions>` — everything of this person's that is on its way out.
 *
 * FOUR arms from `matchList`, and the empty one is the point: "nothing of
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
 * one. Both, labelled, with the difference explained once in a hint.
 *
 * ── `timeout` is a row a person can see ───────────────────────────────────
 *
 * When an owner never receipts, the module marks the request `timeout` rather
 * than quietly leaving it `queued` forever. The table renders that as its own
 * state with an explanation that somebody has been alerted — the alternative
 * (a green tick, or a row that simply never changes) is how a deletion gets
 * forgotten.
 */
import type { ReactElement } from "react";
import { Alert, Card, Empty, Flex, Skeleton, Table, Tag, Tooltip, Typography } from "antd";
import { matchList, useDescribeFlowError, useI18n, useT } from "@stapel/core";
import type { ErasureStatus } from "../api/types.js";
import { toFlowError } from "../flows/errors.js";
import { GDPR_I18N_KEYS } from "../i18n/keys.js";
import { formatDeletionDate } from "../model/dates.js";
import { useMyErasures } from "../model/erasures.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { GdprSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface PendingDeletionsProps extends ThemeModeProp {
  /**
   * Turn a `(subject_type, subject_key)` pair into something a person
   * recognises — "your 12 August stand-up recording", not `9f1c2d3e`.
   *
   * The wire carries the host's own opaque id and nothing else: stapel-gdpr
   * deliberately keeps no copy of the subject's title, because holding one
   * would mean holding the very data the erasure is deleting. Absent a
   * resolver the key is printed, which is ugly and true; dropping the row
   * would be neither.
   */
  readonly labelFor?: (subjectType: string, subjectKey: string) => string;
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
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const bag = useMyErasures();
  const { labelFor } = props;

  const columns = [
    {
      key: "subject",
      title: t(GDPR_I18N_KEYS.deletionsColumnSubject),
      render: (_: unknown, row: ErasureStatus): ReactElement => {
        const typeKey = subjectKeyFor(row.subject_type);
        return (
          <Flex vertical>
            <Typography.Text>
              {labelFor?.(row.subject_type, row.subject_key) ?? row.subject_key}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {typeKey !== undefined ? t(typeKey) : row.subject_type}
            </Typography.Text>
          </Flex>
        );
      },
    },
    {
      key: "state",
      title: t(GDPR_I18N_KEYS.deletionsColumnState),
      render: (_: unknown, row: ErasureStatus): ReactElement => {
        const color = stateColor(row.state);
        const waiting = row.unreceipted_owners ?? [];
        const tag = (
          <Tag {...(color !== undefined ? { color } : {})}>
            {t(stateKeyFor(row.state))}
          </Tag>
        );
        if (row.state === "timeout") {
          return (
            <Tooltip title={t(GDPR_I18N_KEYS.deletionsTimeoutHint)}>{tag}</Tooltip>
          );
        }
        if (waiting.length === 0) return tag;
        return (
          <Tooltip
            title={t(GDPR_I18N_KEYS.deletionsWaitingOn, {
              owners: waiting.join(", "),
            })}
          >
            {tag}
          </Tooltip>
        );
      },
    },
    {
      key: "due",
      title: t(GDPR_I18N_KEYS.deletionsColumnDue),
      render: (_: unknown, row: ErasureStatus): string =>
        formatDeletionDate(row.due_at, locale),
    },
    {
      key: "fully",
      title: (
        <Tooltip title={t(GDPR_I18N_KEYS.deletionsFullyErasedHint)}>
          <span>{t(GDPR_I18N_KEYS.deletionsColumnFullyErased)}</span>
        </Tooltip>
      ),
      render: (_: unknown, row: ErasureStatus): string =>
        formatDeletionDate(row.fully_erased_by, locale),
    },
  ];

  return (
    <GdprSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        data-testid="gdpr-deletions"
        title={t(GDPR_I18N_KEYS.deletionsHeading)}
        size="small"
      >
        {matchList(bag.rows, {
          loading: () => (
            <div data-testid="gdpr-deletions-loading">
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          ),
          failed: (error) => (
            <ErrorAlert
              testId="gdpr-deletions-failed"
              error={describe(toFlowError(error))}
            />
          ),
          empty: () => (
            <Empty
              data-testid="gdpr-deletions-empty"
              description={t(GDPR_I18N_KEYS.deletionsEmpty)}
            />
          ),
          ready: (rows) => (
            <Flex vertical gap={8}>
              {bag.overdue.length > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  data-testid="gdpr-deletions-overdue"
                  message={t(GDPR_I18N_KEYS.deletionsTimeoutHint)}
                />
              ) : null}
              <Table
                data-testid="gdpr-deletions-rows"
                size="small"
                rowKey={(row: ErasureStatus) => row.request_id}
                dataSource={[...rows]}
                columns={columns}
                pagination={false}
              />
            </Flex>
          ),
        })}
      </Card>
    </GdprSkinTheme>
  );
}
