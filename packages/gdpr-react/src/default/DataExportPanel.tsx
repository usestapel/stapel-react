/**
 * `<DataExportPanel>` — the Art. 15 / 20 archive, with a button attached.
 *
 * These endpoints have existed in stapel-gdpr since 0.1 and were reachable
 * from no product: the right of access shipped as a URL nobody wired. This is
 * the smallest honest screen for it.
 *
 * FOUR states, and none of them collapses into another:
 *
 *   loading        — we are asking
 *   failed         — we could not ask
 *   ready(null)    — you have never asked for an archive   (the 404, folded)
 *   ready(status)  — one exists: how far it got, and what you can do with it
 *
 * ── The token is not ours to hold ─────────────────────────────────────────
 *
 * No read on this module returns the download token. It is emailed — on
 * purpose, so that taking a copy of somebody's entire personal data needs
 * something more than a live session in a borrowed browser. So this panel
 * shows the download control only when the HOST passes the token it took from
 * that link (`token` prop), and otherwise says where the link is. Inventing an
 * input box for "paste your token here" would be a worse version of the email.
 *
 * ── One archive at a time, refused BEFORE the request ─────────────────────
 *
 * The 30-day cooldown is a server rule and its refusal is a 409 — but a panel
 * that only learns from the refusal has already asked for a second copy of
 * everything the product knows about a person while the first one is still
 * being built. `status` is `pending`/`processing` right there in the same
 * read, so the button is gated on it (`useActionGate`) and the reason is
 * printed beside the control, where a phone user can read it.
 *
 * ── `download_available` is the server's bit, not `status === "ready"` ────
 *
 * It also encodes "the single-use token is still unspent". A panel that
 * derived it would offer a button that answers 410 to somebody who already
 * downloaded their data — and the two 410s are opposite advice
 * (`download_consumed`: look in your downloads; `download_expired`: ask
 * again), which is why the refusal is read by CODE here as everywhere else.
 */
import { useEffect } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Card, Flex, Progress, Typography } from "antd";
import { spacing, fontSize } from "@stapel/tokens";
import {
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  useDescribeFlowError,
  useI18n,
  useT,
} from "@stapel/core";
import type { ExportStatus } from "../api/types.js";
import { toFlowError } from "../flows/errors.js";
import { GDPR_I18N_KEYS } from "../i18n/keys.js";
import { formatDeletionDate } from "../model/dates.js";
import { useDataExport } from "../model/dataExport.js";
import {
  isDownloadConsumed,
  isDownloadExpired,
  isExportCooldown,
} from "../model/refusals.js";
import type { ThemeModeProp } from "./types.js";

export interface DataExportPanelProps extends ThemeModeProp {
  /**
   * The single-use token from the "your archive is ready" email, when the host
   * routed a page that carries one. Absent, the panel explains where the link
   * is instead of pretending it can produce one.
   */
  readonly token?: string;
  /**
   * What to do with the bytes. Default: hand them to the browser as a save
   * (an object URL and a synthetic click). A host with its own download plumbing
   * — or a native shell — passes its own.
   */
  readonly onArchive?: (archive: { blob: Blob; filename: string | undefined }) => void;
}

function stateKeyFor(status: ExportStatus["status"]): string {
  switch (status) {
    case "processing":
      return GDPR_I18N_KEYS.exportStateProcessing;
    case "ready":
      return GDPR_I18N_KEYS.exportStateReady;
    case "failed":
      return GDPR_I18N_KEYS.exportStateFailed;
    case "expired":
      return GDPR_I18N_KEYS.exportStateExpired;
    default:
      return GDPR_I18N_KEYS.exportStatePending;
  }
}

/** Hand a blob to the browser as a save. Guarded: jsdom has no object URLs. */
function saveArchive(blob: Blob, filename: string | undefined): void {
  if (typeof URL.createObjectURL !== "function") return;
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename ?? "export.zip";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoked immediately: the archive is a copy of everything the product
  // knows about a person, and an object URL keeps it pinned in memory (and
  // addressable from the page) for as long as the document lives.
  URL.revokeObjectURL(href);
}

export function DataExportPanel(props: DataExportPanelProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const bag = useDataExport();
  const { token, onArchive } = props;

  const archive = bag.download.data;
  useEffect(() => {
    if (archive === undefined) return;
    if (onArchive) {
      onArchive({ blob: archive.blob, filename: archive.filename });
      return;
    }
    saveArchive(archive.blob, archive.filename);
  }, [archive, onArchive]);

  const requestError = bag.request.error;
  const cooldown = requestError != null && isExportCooldown(requestError);
  const downloadError = bag.download.error;

  // The archive can actually be taken: the SERVER says the single-use token is
  // still unspent, and the host routed a page carrying that token. Both, or
  // there is nothing to press.
  const downloadToken = bag.downloadAvailable ? token : undefined;

  // A job is already running for this person. `cooldown` only learns that
  // AFTER the server answers 429/409 — by which time a second archive of
  // everything the product knows about somebody has already been asked for.
  // The status is on the wire and the bag reads it (`building`, the same bit
  // its poll runs on), so the control is off BEFORE the duplicate request
  // rather than after it — and the REASON is rendered beside the button by
  // the substrate's gate, never as a tooltip a disabled control cannot fire.
  const requestGate =
    bag.building || cooldown
      ? actionBlocked(
          cooldown
            ? GDPR_I18N_KEYS.errorExportCooldown
            : GDPR_I18N_KEYS.exportInFlight
        )
      : actionAvailable();

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        data-testid="gdpr-export"
        title={t(GDPR_I18N_KEYS.exportHeading)}
        size="small"
      >
        <Flex vertical gap={spacing[3]}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t(GDPR_I18N_KEYS.exportExplain)}
          </Typography.Paragraph>

          <LoadBoundary
            state={bag.state}
            testId="gdpr-export"
            skeletonRows={1}
            onRetry={bag.refetch}
          >
            {(row) =>
              row === null ? (
                // A NON-EVENT is not news. "You have not requested a data
                // export yet" in a full-width info banner announces, in the
                // loudest surface the card has, that nothing has happened —
                // which is true of almost every account that ever opens this
                // screen. Quiet body text, and the button below it is the
                // thing to look at.
                <Typography.Text
                  type="secondary"
                  data-testid="gdpr-export-none"
                >
                  {t(GDPR_I18N_KEYS.exportNone)}
                </Typography.Text>
              ) : (
                <Flex vertical gap={spacing[2]} data-testid="gdpr-export-status">
                  <Typography.Text data-testid="gdpr-export-state">
                    {t(stateKeyFor(row.status))}
                  </Typography.Text>
                  {/* Only while it is being BUILT. A finished archive shown at
                      "80%" beside the word "Ready" states two different things
                      about the same object; the four-of-five is not progress
                      any more, it is the partial-archive finding, and it is
                      named as that by the alert below. */}
                  {bag.building ? (
                    <>
                      {/* Sections done / expected — the server's own two
                          numbers, never a percentage invented from one. */}
                      <Progress
                        percent={
                          row.parts_total > 0
                            ? Math.round((row.parts_done / row.parts_total) * 100)
                            : 0
                        }
                        size="small"
                        data-testid="gdpr-export-progress"
                      />
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: fontSize.xs.fontSize }}
                      >
                        {t(GDPR_I18N_KEYS.exportProgress, {
                          done: row.parts_done,
                          total: row.parts_total,
                        })}
                      </Typography.Text>
                    </>
                  ) : null}
                  {/* A partial archive is still handed over — the deadline does
                      not pause for one silent section — but the person is told
                      WHICH parts are missing rather than finding the hole. */}
                  {bag.missingServices.length > 0 ? (
                    <Alert
                      type="warning"
                      showIcon
                      data-testid="gdpr-export-partial"
                      title={t(GDPR_I18N_KEYS.exportPartial, {
                        services: bag.missingServices.join(", "),
                      })}
                    />
                  ) : null}
                  {bag.expiresAt !== undefined ? (
                    <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
                      {t(GDPR_I18N_KEYS.exportExpires, {
                        date: formatDeletionDate(bag.expiresAt, locale),
                      })}
                    </Typography.Text>
                  ) : null}
                </Flex>
              )
            }
          </LoadBoundary>

          {/* The cooldown is not a failure to report: it is the reason the
              button below is off, and it is rendered THERE. Everything else
              the request can answer is a genuine error. */}
          {cooldown ? null : (
            <ErrorAlert
              testId="gdpr-export-request-failed"
              thrown={requestError}
            />
          )}

          {bag.request.isSuccess ? (
            <Alert
              type="success"
              showIcon
              data-testid="gdpr-export-requested"
              title={t(GDPR_I18N_KEYS.exportRequested)}
            />
          ) : null}

          {downloadError != null ? (
            <Alert
              type="warning"
              showIcon
              data-testid={
                isDownloadConsumed(downloadError)
                  ? "gdpr-export-consumed"
                  : isDownloadExpired(downloadError)
                    ? "gdpr-export-expired"
                    : "gdpr-export-download-failed"
              }
              title={describe(toFlowError(downloadError)).message}
            />
          ) : null}

          <Flex gap={spacing[2]} wrap align="flex-start">
            {/* The reason is TEXT beside the button, never a `title`: a
                disabled control receives no pointer events, so a tooltip on it
                is a reason nobody can read. `GatedButton` wires that text to
                the button's `aria-describedby`, so a screen reader hears the
                reason with the control rather than after hunting for it. */}
            {/* ONE primary, and when an archive is sitting there ready it is
                the one that hands it over. Requesting a second copy of
                everything the product knows about somebody was the loud
                indigo button while "Download archive" was the quiet outline
                beside it — the wrong control shouted. */}
            {downloadToken !== undefined ? (
              <Button
                type="primary"
                loading={bag.download.isPending}
                onClick={() => bag.download.mutate(downloadToken)}
                data-testid="gdpr-export-download"
                data-analytics="none"
                data-analytics-reason="spends a single-use token — host app wraps with its own tracked()"
              >
                {t(GDPR_I18N_KEYS.exportDownload)}
              </Button>
            ) : null}
            <GatedButton
              gate={requestGate}
              {...(downloadToken !== undefined ? {} : { type: "primary" as const })}
              loading={bag.request.isPending}
              onClick={() => bag.request.mutate()}
              testId="gdpr-export-request"
              data-analytics="none"
              data-analytics-reason="starts a server-side job over a read surface — host app wraps with its own tracked()"
            >
              {t(GDPR_I18N_KEYS.exportRequest)}
            </GatedButton>
            {downloadToken === undefined && bag.downloadAvailable ? (
              <Typography.Text type="secondary" data-testid="gdpr-export-token-hint">
                {t(GDPR_I18N_KEYS.exportTokenHint)}
              </Typography.Text>
            ) : null}
          </Flex>
        </Flex>
      </Card>
    </SkinTheme>
  );
}
