/**
 * `<ResponsesPane>` — the response review surface (spec §8.2).
 *
 * Per-version column sets, a version filter, a detail drawer, delete under
 * `forms.responses.manage`, resend with an optional destination override, and
 * CSV export driven by the `X-Forms-Next-Before` header cursor.
 *
 * ── Two things this surface deliberately does not do ───────────────────────
 *
 * 1. **No live counts over a socket.** Refetch only. A
 *    `forms:ws:<workspace_id>` Signal stream is reserved naming for when the
 *    stapel-realtime substrate lands; forms does not build a socket, and that
 *    is a lint boundary rather than an unfinished feature.
 * 2. **No client-side CSV escaping.** The formula-injection guard (a `'`
 *    prefix on a leading `= + - @`) lives SERVER-side, so every consumer
 *    inherits it — a second escape here would double-prefix the cells the
 *    server already fixed.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Drawer,
  Empty,
  Flex,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  matchLoad,
  toFlowError,
  useActionGate,
  useDescribeFlowError,
  useT,
} from "@stapel/core";
import type { Submission } from "../api/types.js";
import { ResponsesTable } from "../headless/ResponsesTable.js";
import type {
  ResponseColumn,
  ResponsesTableBag,
} from "../headless/ResponsesTable.js";
import { FormsSkinTheme } from "./theme.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { resolveFormsSkinComponent } from "./slots.js";
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
  const nextGate = useActionGate(bag.nextPage);
  const prevGate = useActionGate(bag.prevPage);
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
    <Flex gap={8} wrap align="center">
      <Select<number | null>
        style={{ width: 180 }}
        value={bag.version}
        onChange={(next) => bag.setVersion(next)}
        data-testid="forms-responses-version"
        options={[
          { value: null, label: t(FORMS_I18N_KEYS.responsesAllVersions) },
          ...versionOptions,
        ]}
      />
      <Button
        disabled={prevGate.disabled}
        data-analytics="none"
        data-analytics-reason="keyset paging of a read; no flow to step"
        onClick={bag.goPrevPage}
      >
        {t(FORMS_I18N_KEYS.responsesPrev)}
      </Button>
      <Button
        disabled={nextGate.disabled}
        data-analytics="none"
        data-analytics-reason="keyset paging of a read; no flow to step"
        data-testid="forms-responses-next"
        onClick={bag.goNextPage}
      >
        {t(FORMS_I18N_KEYS.responsesNext)}
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
      {nextGate.reason !== undefined && (
        <Typography.Text type="secondary">{nextGate.reason}</Typography.Text>
      )}
    </Flex>
  );
}

function DetailDrawer(props: { bag: ResponsesTableBag }): ReactElement {
  const t = useT();
  const { bag } = props;
  const [override, setOverride] = useState("");
  const row = bag.selected;

  return (
    <Drawer
      open={row !== null}
      onClose={() => bag.select(null)}
      title={t(FORMS_I18N_KEYS.responsesDetail)}
      width={480}
      data-testid="forms-responses-drawer"
    >
      {row !== null && (
        <Flex vertical gap={12}>
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
            placeholder={t(FORMS_I18N_KEYS.responsesResendOverride)}
            value={override}
            onChange={(event) => setOverride(event.target.value)}
            data-testid="forms-resend-override"
          />
          <Space>
            <Button
              loading={bag.isResending}
              data-analytics="flow"
              data-testid="forms-resend"
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
            </Button>
            <Popconfirm
              title={t(FORMS_I18N_KEYS.responsesDeleteConfirm)}
              onConfirm={() => bag.remove(row.id)}
            >
              <Button danger loading={bag.isRemoving} data-analytics="flow">
                {t(FORMS_I18N_KEYS.responsesDelete)}
              </Button>
            </Popconfirm>
          </Space>
          {bag.lastResendCount !== null && (
            <Typography.Text type="success" data-testid="forms-resend-sent">
              {t(FORMS_I18N_KEYS.responsesResendSent, {
                count: bag.lastResendCount,
              })}
            </Typography.Text>
          )}
        </Flex>
      )}
    </Drawer>
  );
}

export interface ResponsesPaneProps extends ThemeModeProp {
  readonly workspaceId: string;
  readonly formId: string;
  readonly limit?: number;
}

export function ResponsesPane(props: ResponsesPaneProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();

  return (
    <FormsSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <ResponsesTable
        workspaceId={props.workspaceId}
        formId={props.formId}
        {...(props.limit !== undefined ? { limit: props.limit } : {})}
      >
        {(bag) => (
          <Flex vertical gap={16}>
            <Typography.Title level={4}>
              {t(FORMS_I18N_KEYS.responsesTitle)}
            </Typography.Title>
            <Toolbar bag={bag} />
            {bag.error !== null && (
              <ErrorAlert
                testId="forms-responses-error"
                error={describe(toFlowError(bag.error))}
              />
            )}
            {matchLoad(bag.state, {
              loading: () => (
                <Flex justify="center" style={{ padding: 24 }}>
                  <Spin data-testid="forms-responses-loading" />
                </Flex>
              ),
              // "We could not load the responses" — never an empty grid,
              // which would read as "nobody answered".
              failed: (error) => (
                <ErrorAlert
                  testId="forms-responses-failed"
                  error={{
                    ...describe(toFlowError(error)),
                    message: t(FORMS_I18N_KEYS.responsesLoadFailed),
                  }}
                  action={
                    <Button
                      size="small"
                      onClick={bag.refetch}
                      data-analytics="none"
                      data-analytics-reason="retry of a failed read; no flow to step"
                    >
                      {t(FORMS_I18N_KEYS.fillRetry)}
                    </Button>
                  }
                />
              ),
              ready: (view) =>
                view.rows.length === 0 ? (
                  <Empty
                    data-testid="forms-responses-empty"
                    description={t(FORMS_I18N_KEYS.responsesEmpty)}
                  />
                ) : (
                  <Table<Submission>
                    size="small"
                    rowKey="id"
                    data-testid="forms-responses-table"
                    dataSource={[...view.rows]}
                    pagination={false}
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
                ),
            })}
            <DetailDrawer bag={bag} />
          </Flex>
        )}
      </ResponsesTable>
    </FormsSkinTheme>
  );
}
