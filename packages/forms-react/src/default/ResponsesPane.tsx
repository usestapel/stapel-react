/**
 * `<ResponsesPane>` — the response review surface (spec §8.2).
 *
 * Per-version column sets, a version filter, a detail dialog (a bottom sheet
 * on a phone, a centred modal above the tablet breakpoint — one rule, from
 * `@stapel/tokens-antd/skin`), delete, resend with an optional destination
 * override, and CSV export driven by the `X-Forms-Next-Before` header cursor.
 *
 * ── Who may delete or resend ───────────────────────────────────────────────
 *
 * `forms.responses.manage` — the capability stapel-forms 0.3.0 started
 * PROJECTING (`docs/capabilities.json`, and `x-stapel-capability` on
 * `DELETE /submissions/<id>` and `POST /submissions/<id>/resend`). It is the
 * destructive half of response handling and is granted separately from
 * reading, so a reviewer may legitimately hold `forms.responses.view` and
 * nothing else.
 *
 * When the host declares the caller's grants on the runtime, the write block
 * is switched off with the capability NAMED beside it: one `GatedControl`
 * over the override field and both buttons, so the sentence is rendered once
 * and `aria-describedby` links all three to it. When the host declares
 * nothing the controls stay live and the server answers — an unknown grant is
 * not a refusal, and a guessed "you may not" is the same defect as a dead
 * button.
 *
 * ── A denial and an outage are different pictures ───────────────────────────
 *
 * stapel-forms 0.4.0 (on stapel-core 0.47.0) split them: a 403 is a VERDICT
 * that may be treated as one, and a workspaces outage is
 * `503 error.503.forms_workspaces_unavailable`. The contract's old warning
 * that a 403 "might mean no verdict was reached" is gone, so this surface
 * stops hedging too — `classifyGateRefusal` picks the arm, the denial says
 * which permission to ask for and offers no retry, and the outage says it is
 * on our side and does.
 *
 * ── Freshness: POLLING, declared ───────────────────────────────────────────
 *
 * This list is **refetch-only, and it says so on screen**. stapel-forms 0.2.0
 * ships no realtime consumer at all — MODULE.md §11 lists "realtime response
 * feed" as out of scope and RESERVES the stream name `forms:ws:<workspace_id>`
 * for a consumer that does not exist ("modules do not open sockets"), so there
 * is nothing for `@stapel/realtime` to subscribe to. A socket opened here
 * would be this pair inventing a protocol the backend does not speak, which is
 * precisely the defect `@stapel/realtime` was extracted to end.
 *
 * The policy that replaces it is explicit rather than silent: no background
 * timer (a table that reorders itself under a reviewer's cursor mid-read is
 * worse than a stale one), one visible "check for new responses" control, and
 * one sentence saying the list does not update on its own. When stapel-forms
 * grows the consumer, this comment and that sentence are what get deleted —
 * see `SCRATCH/wave-b/REQUESTS-forms-react.md`.
 *
 * ── No client-side CSV escaping ────────────────────────────────────────────
 *
 * The formula-injection guard (a `'` prefix on a leading `= + - @`) lives
 * SERVER-side, so every consumer inherits it — a second escape here would
 * double-prefix the cells the server already fixed.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Input, Select, Space, Table, Tag, Typography } from "antd";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  GatedControl,
  LoadBoundary,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  matchLoad,
  useT,
} from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { Submission } from "../api/types.js";
import {
  FORMS_CAPABILITIES,
  classifyGateRefusal,
  useFormsCapabilityGate,
} from "../model/capabilities.js";
import { ResponsesTable } from "../headless/ResponsesTable.js";
import type {
  ResponseColumn,
  ResponsesTableBag,
} from "../headless/ResponsesTable.js";
import { RESPONSE_DIALOG_WIDTH, VERSION_SELECT_WIDTH } from "./geometry.js";
import { resolveFormsSkinComponent } from "./slots.js";
import { MissingWorkspaceNotice, useFormsWorkspaceId } from "./workspace.js";
import { skinThemeProps } from "./types.js";
import type { ThemeModeProp } from "./types.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** Props of the `"responses.cell"` slot. */
export interface ResponseCellSlotProps {
  readonly column: ResponseColumn;
  readonly row: Submission;
  readonly value: unknown;
}

/** Props of the `"responses.toolbar"` slot. */
export interface ResponsesToolbarSlotProps {
  readonly bag: ResponsesTableBag;
}

/** Render one answer. Objects and arrays are JSON, not `[object Object]` —
 * a reviewer looking at a `convertible_unit` or a multi-select must be able
 * to read what was actually submitted. */
function renderAnswer(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map((entry) => renderAnswer(entry)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Cell(props: ResponseCellSlotProps): ReactElement {
  const Slot = resolveFormsSkinComponent<ResponseCellSlotProps>("responses.cell");
  if (Slot) return <Slot {...props} />;
  return <span>{renderAnswer(props.value)}</span>;
}

function Toolbar(props: ResponsesToolbarSlotProps): ReactElement {
  const t = useT();
  const { bag } = props;
  const Slot = resolveFormsSkinComponent<ResponsesToolbarSlotProps>(
    "responses.toolbar"
  );
  if (Slot) return <Slot {...props} />;

  const versionOptions = matchLoad(bag.versions, {
    loading: () => [],
    failed: () => [],
    ready: (versions) =>
      versions.map((v) => ({
        value: v.version,
        label: `${t(FORMS_I18N_KEYS.responsesVersion)} ${v.version}`,
      })),
  });

  return (
    <Flex vertical gap={spacing[1]}>
      <Flex gap={spacing[2]} wrap align="flex-start">
        <Select<number | null>
          aria-label={t(FORMS_I18N_KEYS.responsesVersion)}
          style={{ width: VERSION_SELECT_WIDTH }}
          value={bag.version}
          onChange={(next) => bag.setVersion(next)}
          data-testid="forms-responses-version"
          options={[
            { value: null, label: t(FORMS_I18N_KEYS.responsesAllVersions) },
            ...versionOptions,
          ]}
        />
        <GatedButton
          gate={bag.prevPage}
          layout="inline"
          data-analytics="none"
          data-analytics-reason="keyset paging of a read; no flow to step"
          testId="forms-responses-prev"
          onClick={bag.goPrevPage}
        >
          {t(FORMS_I18N_KEYS.responsesPrev)}
        </GatedButton>
        <GatedButton
          gate={bag.nextPage}
          layout="inline"
          data-analytics="none"
          data-analytics-reason="keyset paging of a read; no flow to step"
          testId="forms-responses-next"
          onClick={bag.goNextPage}
        >
          {t(FORMS_I18N_KEYS.responsesNext)}
        </GatedButton>
        <Button
          data-analytics="none"
          data-analytics-reason="manual refetch of a read; no flow to step"
          data-testid="forms-responses-refresh"
          onClick={bag.refetch}
        >
          {t(FORMS_I18N_KEYS.responsesRefresh)}
        </Button>
        <Button
          loading={bag.isExporting}
          data-analytics="flow"
          data-testid="forms-responses-export"
          onClick={() => {
            void bag.exportCsv();
          }}
        >
          {bag.isExporting
            ? t(FORMS_I18N_KEYS.responsesExporting, { pages: bag.exportPages })
            : t(FORMS_I18N_KEYS.responsesExport)}
        </Button>
      </Flex>
      {/* The freshness policy, said once where the list is: this is polling,
          and nothing arrives on its own. */}
      <Typography.Text type="secondary" data-testid="forms-responses-polling">
        {t(FORMS_I18N_KEYS.responsesPollingNote)}
      </Typography.Text>
    </Flex>
  );
}

/**
 * The response detail surface — a vertical read-and-act journey over one
 * submission, so a dialog rather than navigation: a bottom sheet on a phone,
 * a centred modal on tablet and desktop. The sheet is viewport-wide, so
 * `width` applies to the modal only.
 */
function DetailDialog(props: { bag: ResponsesTableBag }): ReactElement {
  const t = useT();
  const { bag } = props;
  const [override, setOverride] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const row = bag.selected;

  // Two independent reasons a write can be off, ordered the way you would
  // explain the situation to a person: the CAPABILITY is a property of the
  // caller and holds for every row, so it is said first; the erasure is a
  // property of THIS row. `firstBlock` shows exactly one, and there is no way
  // to spell "blocked, reason unknown".
  //
  // An erased row has no answers left: resending it would deliver an empty
  // letter and deleting it would erase what the retention job already erased.
  const manageGate = useFormsCapabilityGate(FORMS_CAPABILITIES.responsesManage);
  const erasedGate =
    row !== null && row.erased_at != null
      ? actionBlocked(FORMS_I18N_KEYS.responsesErasedNoWrite)
      : actionAvailable();
  const writeGate = firstBlock(manageGate, erasedGate);

  return (
    <SkinDialog
      open={row !== null}
      onClose={() => bag.select(null)}
      title={t(FORMS_I18N_KEYS.responsesDetail)}
      dismissLabel={t(FORMS_I18N_KEYS.responsesClose)}
      width={RESPONSE_DIALOG_WIDTH}
      data-testid="forms-responses-dialog"
    >
      {row !== null && (
        <Flex vertical gap={spacing[3]}>
          <Typography.Text type="secondary">
            {t(FORMS_I18N_KEYS.responsesVersion)} {row.version} ·{" "}
            {row.submitted_at}
          </Typography.Text>
          {row.erased_at != null && <Tag>{t(FORMS_I18N_KEYS.responsesErased)}</Tag>}
          {Object.entries(row.answers).map(([slug, value]) => (
            <div key={slug}>
              <Typography.Text strong>{slug}</Typography.Text>
              <br />
              <Typography.Text>{renderAnswer(value)}</Typography.Text>
            </div>
          ))}

          <Typography.Text type="secondary">
            {t(FORMS_I18N_KEYS.responsesResendOverrideHint)}
          </Typography.Text>
          {/* ONE gate over the whole write block. Three controls share one
              reason and one `aria-describedby` target — repeating the same
              sentence under each would be three answers to one question, and
              the override field had no readable reason at all before. */}
          <GatedControl gate={writeGate} testId="forms-responses-write-gate">
            {(bind) => (
              <Flex vertical gap={spacing[3]}>
                <Input
                  aria-label={t(FORMS_I18N_KEYS.responsesResendOverride)}
                  placeholder={t(FORMS_I18N_KEYS.responsesResendOverride)}
                  value={override}
                  onChange={(event) => setOverride(event.target.value)}
                  data-testid="forms-resend-override"
                  {...bind}
                />
                <Space wrap>
                  <Button
                    loading={bag.isResending}
                    data-analytics="flow"
                    data-testid="forms-resend"
                    onClick={() => {
                      const recipients = override
                        .split(",")
                        .map((entry) => entry.trim())
                        .filter((entry) => entry.length > 0);
                      // Only send an override when the operator typed one: an
                      // empty list would REPLACE the form's targets with
                      // nothing.
                      bag.resend(
                        row.id,
                        recipients.length > 0 ? { recipients } : undefined
                      );
                    }}
                    {...bind}
                  >
                    {t(FORMS_I18N_KEYS.responsesResend)}
                  </Button>
                  <Button
                    danger
                    data-analytics="none"
                    data-analytics-reason="opens the delete confirmation; the DELETE inside it is the tracked step"
                    data-testid="forms-delete"
                    onClick={() => setConfirmingDelete(true)}
                    {...bind}
                  >
                    {t(FORMS_I18N_KEYS.responsesDelete)}
                  </Button>
                </Space>
              </Flex>
            )}
          </GatedControl>
          {bag.lastResendCount !== null && (
            <Typography.Text type="success" data-testid="forms-resend-sent">
              {t(FORMS_I18N_KEYS.responsesResendSent, {
                count: bag.lastResendCount,
              })}
            </Typography.Text>
          )}

          <SkinConfirm
            open={confirmingDelete}
            danger
            confirming={bag.isRemoving}
            title={t(FORMS_I18N_KEYS.responsesDeleteConfirm)}
            confirmLabel={t(FORMS_I18N_KEYS.responsesDelete)}
            onConfirm={() => {
              bag.remove(row.id);
              setConfirmingDelete(false);
            }}
            onCancel={() => setConfirmingDelete(false)}
            data-testid="forms-delete-confirm"
          />
        </Flex>
      )}
    </SkinDialog>
  );
}

/**
 * A failure from a gated route, drawn as ONE of three pictures.
 *
 * The split is what stapel-forms 0.4.0 bought: a 403 is a decision about this
 * caller (say which permission to ask for; a retry would just re-ask the same
 * question and get the same answer), a 503 is the workspaces service failing
 * to answer (say it is on our side, and offer the retry), and anything else
 * keeps the caller's own sentence. Before 0.4.0 the first two were the same
 * byte on the wire and this component could not have existed honestly.
 */
function GateAwareError(props: {
  readonly thrown: unknown;
  readonly testId: string;
  /** The sentence for a failure that is not the gate's. */
  readonly message?: string;
  readonly onRetry: () => void;
}): ReactElement {
  const t = useT();
  switch (classifyGateRefusal(props.thrown)) {
    case "unavailable":
      return (
        <ErrorAlert
          testId={`${props.testId}-unavailable`}
          message={t(FORMS_I18N_KEYS.responsesGateUnavailable)}
          thrown={props.thrown}
          onRetry={props.onRetry}
        />
      );
    case "denied":
      return (
        <ErrorAlert
          testId={`${props.testId}-forbidden`}
          message={t(FORMS_I18N_KEYS.responsesForbidden)}
          thrown={props.thrown}
        />
      );
    default:
      return (
        <ErrorAlert
          testId={props.testId}
          {...(props.message !== undefined ? { message: props.message } : {})}
          thrown={props.thrown}
          onRetry={props.onRetry}
        />
      );
  }
}

export interface ResponsesPaneProps extends ThemeModeProp {
  /** Omit to use the runtime's `workspaceId` (the routable case). */
  readonly workspaceId?: string;
  readonly formId: string;
  readonly limit?: number;
}

export function ResponsesPane(props: ResponsesPaneProps): ReactElement {
  const t = useT();
  const workspaceId = useFormsWorkspaceId(props.workspaceId);

  if (workspaceId === null) {
    return (
      <SkinTheme {...skinThemeProps(props)}>
        <MissingWorkspaceNotice testId="forms-responses-no-workspace" />
      </SkinTheme>
    );
  }

  return (
    <SkinTheme {...skinThemeProps(props)}>
      <ResponsesTable
        workspaceId={workspaceId}
        formId={props.formId}
        {...(props.limit !== undefined ? { limit: props.limit } : {})}
      >
        {(bag) => (
          <Flex vertical gap={spacing[4]}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t(FORMS_I18N_KEYS.responsesTitle)}
            </Typography.Title>
            <Toolbar bag={bag} />
            {bag.error !== null && (
              <GateAwareError
                thrown={bag.error}
                testId="forms-responses-error"
                onRetry={bag.refetch}
              />
            )}
            <LoadBoundary
              state={bag.state}
              onRetry={bag.refetch}
              testId="forms-responses"
              // "We could not load the responses" — never an empty grid,
              // which would read as "nobody answered".
              failed={(thrown) => (
                <GateAwareError
                  thrown={thrown}
                  testId="forms-responses-failed"
                  message={t(FORMS_I18N_KEYS.responsesLoadFailed)}
                  onRetry={bag.refetch}
                />
              )}
            >
              {(view) =>
                view.rows.length === 0 ? (
                  <EmptyState
                    testId="forms-responses-empty"
                    title={t(FORMS_I18N_KEYS.responsesEmpty)}
                  />
                ) : (
                  <Table<Submission>
                    size="small"
                    rowKey="id"
                    data-testid="forms-responses-table"
                    dataSource={[...view.rows]}
                    pagination={false}
                    // Two fixed columns plus ONE PER QUESTION: a ten-question
                    // form is a twelve-column grid, which on a phone is a
                    // squeezed, unreadable and unreachable table without its
                    // own horizontal scroller.
                    scroll={{ x: true }}
                    onRow={(row) => ({ onClick: () => bag.select(row) })}
                    columns={[
                      {
                        title: t(FORMS_I18N_KEYS.responsesSubmittedAt),
                        dataIndex: "submitted_at",
                        key: "submitted_at",
                      },
                      {
                        title: t(FORMS_I18N_KEYS.responsesVersion),
                        dataIndex: "version",
                        key: "version",
                      },
                      ...view.columns.map((column) => ({
                        title: column.title,
                        key: column.slug,
                        render: (_: unknown, row: Submission) => (
                          <Cell
                            column={column}
                            row={row}
                            value={row.answers[column.slug]}
                          />
                        ),
                      })),
                    ]}
                  />
                )
              }
            </LoadBoundary>
            <DetailDialog bag={bag} />
          </Flex>
        )}
      </ResponsesTable>
    </SkinTheme>
  );
}
