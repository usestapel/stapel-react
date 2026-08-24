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
 * The server does. `forms.responses.manage` is enforced BACKEND-side and the
 * published contract (`docs/schema.json` → `src/api/generated/schema.ts`)
 * exposes no projection of it: every admin route is documented
 * `IsNotAnonymousUser`, and neither `SubmissionPresenterDTO` nor
 * `FormPresenterDTO` carries a per-principal capability field. So this surface
 * does NOT pre-gate the two writes on a capability — a client-side gate would
 * have to guess, and a guessed "you may not" is the same defect as a dead
 * button. A refusal arrives as the mutation's own error and is rendered by
 * `<ErrorAlert>`. The one thing that IS knowable here is the ROW's state, and
 * that is gated below.
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
  LoadBoundary,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  matchLoad,
  useActionGate,
  useT,
} from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { Submission } from "../api/types.js";
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

  // An erased row has no answers left. Resending it would deliver an empty
  // letter and deleting it would erase what the retention job already erased —
  // both are refusals waiting to happen, so both are switched off HERE, with
  // the reason printed as text beside them (a disabled control receives no
  // pointer events, so a tooltip is a reason nobody can read).
  const writeGate =
    row !== null && row.erased_at != null
      ? actionBlocked(FORMS_I18N_KEYS.responsesErasedNoWrite)
      : actionAvailable();
  const writeView = useActionGate(writeGate);

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
          <Input
            aria-label={t(FORMS_I18N_KEYS.responsesResendOverride)}
            placeholder={t(FORMS_I18N_KEYS.responsesResendOverride)}
            value={override}
            disabled={writeView.disabled}
            data-disabled-reason="erased row; the reason is printed under the action row"
            onChange={(event) => setOverride(event.target.value)}
            data-testid="forms-resend-override"
          />
          <Space wrap>
            <GatedButton
              gate={writeGate}
              loading={bag.isResending}
              data-analytics="flow"
              testId="forms-resend"
              onClick={() => {
                const recipients = override
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter((entry) => entry.length > 0);
                // Only send an override when the operator typed one: an empty
                // list would REPLACE the form's targets with nothing.
                bag.resend(
                  row.id,
                  recipients.length > 0 ? { recipients } : undefined
                );
              }}
            >
              {t(FORMS_I18N_KEYS.responsesResend)}
            </GatedButton>
            <GatedButton
              gate={writeGate}
              danger
              data-analytics="none"
              data-analytics-reason="opens the delete confirmation; the DELETE inside it is the tracked step"
              testId="forms-delete"
              onClick={() => setConfirmingDelete(true)}
            >
              {t(FORMS_I18N_KEYS.responsesDelete)}
            </GatedButton>
          </Space>
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
            <ErrorAlert
              testId="forms-responses-error"
              {...(bag.error !== null ? { thrown: bag.error } : {})}
            />
            <LoadBoundary
              state={bag.state}
              onRetry={bag.refetch}
              testId="forms-responses"
              // "We could not load the responses" — never an empty grid,
              // which would read as "nobody answered".
              failed={(thrown) => (
                <ErrorAlert
                  testId="forms-responses-failed"
                  message={t(FORMS_I18N_KEYS.responsesLoadFailed)}
                  thrown={thrown}
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
