/**
 * `<OwnersHealth>` — every declared data owner, and whether it is answering.
 *
 * ── A silent owner is a WARNING ROW, never an absent one ──────────────────
 *
 * This is the whole component. The table is built from the INVENTORY (every
 * owner `DATA_OWNERS` declares), not from the answers, so a system that never
 * replies appears as a red row saying "silent" instead of vanishing from a
 * list that then looks perfectly healthy. That inversion is the defect the
 * probe/`alive` machinery exists to fix: the fleet audit behind it found seven
 * owners in a running product whose `consume_actions` process had never been
 * started, and the only trace was an erasure that sat `queued` until a sweep
 * marked it `timeout` — with a log line nobody read.
 *
 * `alive` is the SERVER's bit (it compares `last_alive_at` against the
 * deployment's `OWNER_ALIVE_MAX_AGE_HOURS`), so nothing here re-derives
 * liveness from a timestamp and a guess at the threshold.
 *
 * ── The third state: answering, but for the wrong subjects ────────────────
 *
 * An owner can be alive and still claim a different set of subject types than
 * the inventory declares — usually a library upgraded on one side of a fleet.
 * It is not silent, so nothing alerts, but an erasure of the subject it
 * stopped claiming now gets no receipt slot at all. The row shows both sets.
 */
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Skeleton,
  Table,
  Tag,
  Typography,
} from "antd";
import { matchList, useDescribeFlowError, useI18n, useT } from "@stapel/core";
import type { DataOwnerHealth as DataOwnerHealthRow } from "../../api/types.js";
import { toFlowError } from "../../flows/errors.js";
import { GDPR_I18N_KEYS } from "../../i18n/keys.js";
import { formatInstant } from "../../model/dates.js";
import { useOwnersHealth } from "../../model/owners.js";
import { isStaffOnly } from "../../model/refusals.js";
import { ErrorAlert } from "../ErrorAlert.js";
import { GdprSkinTheme } from "../theme.js";
import type { ThemeModeProp } from "../types.js";

export type OwnersHealthProps = ThemeModeProp;

export function OwnersHealth(props: OwnersHealthProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const bag = useOwnersHealth();

  const mismatched = new Set(bag.mismatched.map((row) => row.owner));

  const columns = [
    {
      key: "owner",
      title: t(GDPR_I18N_KEYS.ownersColumnOwner),
      render: (_: unknown, row: DataOwnerHealthRow): string => row.owner,
    },
    {
      key: "state",
      title: t(GDPR_I18N_KEYS.ownersColumnState),
      render: (_: unknown, row: DataOwnerHealthRow): ReactElement =>
        row.alive ? (
          <Tag color="green">{t(GDPR_I18N_KEYS.ownersAlive)}</Tag>
        ) : (
          <Tag color="red" data-testid="gdpr-owners-silent-tag">
            {t(GDPR_I18N_KEYS.ownersSilent)}
          </Tag>
        ),
    },
    {
      key: "lastAlive",
      title: t(GDPR_I18N_KEYS.ownersColumnLastAlive),
      render: (_: unknown, row: DataOwnerHealthRow): string =>
        // "never" and "a long time ago" are different findings: one is an
        // owner that was never wired at all, the other one that stopped.
        row.last_alive_at != null
          ? formatInstant(row.last_alive_at, locale)
          : t(GDPR_I18N_KEYS.ownersNeverAnswered),
    },
    {
      key: "subjects",
      title: t(GDPR_I18N_KEYS.ownersColumnSubjects),
      render: (_: unknown, row: DataOwnerHealthRow): ReactElement => {
        const declared = row.declared_subject_types ?? [];
        const answered = row.answered_subject_types ?? [];
        return (
          <Flex vertical>
            <Typography.Text>{declared.join(", ")}</Typography.Text>
            {mismatched.has(row.owner) ? (
              <Typography.Text
                type="warning"
                style={{ fontSize: 12 }}
                data-testid="gdpr-owners-mismatch"
              >
                {t(GDPR_I18N_KEYS.ownersSubjectMismatch, {
                  declared: declared.join(", "),
                  answered: answered.join(", "),
                })}
              </Typography.Text>
            ) : null}
          </Flex>
        );
      },
    },
  ];

  return (
    <GdprSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        data-testid="gdpr-owners"
        title={t(GDPR_I18N_KEYS.ownersHeading)}
        size="small"
      >
        <Flex vertical gap={8}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t(GDPR_I18N_KEYS.ownersExplain)}
          </Typography.Paragraph>

          {matchList(bag.rows, {
            loading: () => (
              <div data-testid="gdpr-owners-loading">
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ),
            failed: (error) =>
              isStaffOnly(error) ? (
                <Alert
                  type="info"
                  showIcon
                  data-testid="gdpr-owners-staff-only"
                  message={t(GDPR_I18N_KEYS.staffOnly)}
                />
              ) : (
                <ErrorAlert
                  testId="gdpr-owners-failed"
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
            // An empty inventory is not "all healthy": it means NOTHING would
            // receive an erasure. The emptiest table on this screen is its
            // worst finding, so it is named rather than left blank.
            empty: () => (
              <Empty
                data-testid="gdpr-owners-empty"
                description={t(GDPR_I18N_KEYS.ownersEmpty)}
              />
            ),
            ready: (rows) => (
              <Flex vertical gap={8}>
                {bag.silent.length > 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    data-testid="gdpr-owners-silent-summary"
                    message={t(GDPR_I18N_KEYS.ownersSilentCount, {
                      count: bag.silent.length,
                      total: rows.length,
                    })}
                  />
                ) : null}
                <Table
                  data-testid="gdpr-owners-rows"
                  size="small"
                  rowKey={(row: DataOwnerHealthRow) => row.owner}
                  dataSource={[...rows]}
                  columns={columns}
                  pagination={false}
                  rowClassName={(row: DataOwnerHealthRow) =>
                    row.alive ? "" : "gdpr-owner-silent"
                  }
                />
              </Flex>
            ),
          })}
        </Flex>
      </Card>
    </GdprSkinTheme>
  );
}
