/**
 * `<UploadTrayPanel/>` — the upload queue, drawn.
 *
 * One bar per file, and the bar is REAL: it moves because the XHR PUT
 * reported bytes, not because a spinner is spinning (see `api/upload.ts`).
 * Two files move at once and the rest say "waiting", which is the truth about
 * a queue with concurrency 2 — a row sitting at 0% with an animated bar is a
 * lie a person waits on.
 *
 * ── The quota state is its own message ────────────────────────────────────
 *
 * `error.507.docs_workspace_quota` gets a banner above the list with the two
 * things that actually help (empty the trash, ask for more room), and the
 * failed rows below it do NOT offer Retry: retrying a full workspace is the
 * same refusal at the same second, and a button that cannot work is worse
 * than no button. Every other failure keeps its per-row Retry.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("uploadTray", …)`.
 */
import type { ReactElement } from "react";
import { Alert, Button, Flex, List, Progress, Typography } from "antd";
import { EmptyState, ErrorAlert, SkinTheme } from "@stapel/tokens-antd/skin";
import { fontSize, spacing } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useI18n, useT } from "@stapel/core";
import { formatBytes } from "@stapel/docs-react";
import type { UploadTrayBag } from "../headless/UploadTray.js";
import type { UploadItem } from "../model/uploadQueue.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { UPLOAD_ROW_BAR_HEIGHT } from "./measure.js";

export interface UploadTrayPanelProps {
  /** The queue to draw — the bag from `<UploadTray>` / `useUploadQueue`. */
  readonly bag: UploadTrayBag;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

const STATUS_KEY: Readonly<Record<UploadItem["status"], string>> = {
  queued: DRIVE_I18N_KEYS.uploadQueued,
  uploading: DRIVE_I18N_KEYS.uploadUploading,
  done: DRIVE_I18N_KEYS.uploadDone,
  failed: DRIVE_I18N_KEYS.uploadFailed,
  canceled: DRIVE_I18N_KEYS.uploadCanceled,
};

export function UploadTrayPanel(props: UploadTrayPanelProps): ReactElement {
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <UploadTrayPanelBody bag={props.bag} />
    </SkinTheme>
  );
}

function UploadTrayPanelBody(props: { readonly bag: UploadTrayBag }): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { bag } = props;

  function row(item: UploadItem): ReactElement {
    const percent =
      item.progress === null ? 0 : Math.round(item.progress * 100);
    return (
      <List.Item
        key={item.id}
        data-testid={`drive-upload-${item.id}`}
        data-drive-upload-status={item.status}
      >
        <Flex vertical gap={spacing[1]} style={{ width: "100%" }}>
          <Flex justify="space-between" align="center" gap={spacing[2]}>
            <Typography.Text ellipsis style={{ flex: 1 }}>
              {item.name}
            </Typography.Text>
            <Typography.Text
              type="secondary"
              style={{ fontSize: fontSize.xs.fontSize }}
            >
              {`${t(STATUS_KEY[item.status])} · ${formatBytes(item.size, locale)}`}
            </Typography.Text>
          </Flex>
          <div style={{ minHeight: UPLOAD_ROW_BAR_HEIGHT }}>
            {item.status === "uploading" && (
              <Progress
                percent={percent}
                size="small"
                // `null` progress means the browser could not say how big the
                // body is; an indeterminate bar is honest, a 0% one is not.
                status={item.progress === null ? "active" : "normal"}
                data-testid={`drive-upload-progress-${item.id}`}
              />
            )}
          </div>
          {item.status === "failed" && (
            <Flex vertical gap={spacing[1]}>
              <ErrorAlert
                thrown={item.error}
                variant="inline"
                testId={`drive-upload-error-${item.id}`}
              />
              {!item.quotaExceeded && (
                <Button
                  size="small"
                  data-testid={`drive-upload-retry-${item.id}`}
                  data-analytics="none"
                  data-analytics-reason="re-runs one queued transfer — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                  onClick={() => {
                    bag.retry(item.id);
                  }}
                >
                  {t(DRIVE_I18N_KEYS.uploadRetry)}
                </Button>
              )}
            </Flex>
          )}
          {(item.status === "queued" || item.status === "uploading") && (
            <Button
              size="small"
              type="text"
              data-testid={`drive-upload-cancel-${item.id}`}
              data-analytics="none"
              data-analytics-reason="aborts one transfer — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
              onClick={() => {
                bag.cancel(item.id);
              }}
            >
              {t(DRIVE_I18N_KEYS.uploadCancel)}
            </Button>
          )}
        </Flex>
      </List.Item>
    );
  }

  return (
    <Flex vertical gap={spacing[2]} data-testid="drive-upload-tray">
      {bag.quotaExceeded && (
        <Alert
          type="error"
          showIcon
          title={t(DRIVE_I18N_KEYS.uploadQuotaTitle)}
          description={t(DRIVE_I18N_KEYS.uploadQuotaHint)}
          data-testid="drive-upload-quota"
        />
      )}
      {bag.items.length === 0 ? (
        <EmptyState
          title={t(DRIVE_I18N_KEYS.uploadEmpty)}
          compact
          testId="drive-upload-empty"
        />
      ) : (
        <>
          <List dataSource={[...bag.items]} renderItem={row} rowKey="id" />
          <Flex justify="flex-end">
            <Button
              size="small"
              type="text"
              data-testid="drive-upload-clear"
              data-analytics="none"
              data-analytics-reason="clears finished rows from the tray — no server effect, nothing to count"
              onClick={bag.clearFinished}
            >
              {t(DRIVE_I18N_KEYS.uploadClear)}
            </Button>
          </Flex>
        </>
      )}
    </Flex>
  );
}
