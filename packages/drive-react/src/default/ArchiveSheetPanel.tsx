/**
 * `<ArchiveSheetPanel/>` — a zip document browsed like a folder, as a bottom
 * sheet (the row-actions / share-sheet shape).
 *
 * ── What the server gives it ──────────────────────────────────────────────
 *
 * ONE listing (`GET /documents/:id/archive` — the central directory, read
 * server-side by ranged storage reads and CAPPED, never truncated), and one
 * member at a time (`GET …/archive/entry?path=`, extracted server-side under
 * the same ceilings). The sheet does the folder illusion locally: entries
 * arrive flat, and descending a "directory" is a prefix filter over the
 * array the first request already paid for.
 *
 * ── Encryption is a state ─────────────────────────────────────────────────
 *
 * `archive_encrypted` draws the lock banner with a password field; the
 * password lives in COMPONENT STATE for the life of the open sheet and rides
 * each extraction as the `X-Docs-Archive-Password` header — never stored,
 * never in a URL. A wrong password is the server's own named refusal
 * (`error.400.docs_archive_password_wrong`), rendered, not translated into
 * a generic failure.
 *
 * ── Member preview and download ───────────────────────────────────────────
 *
 * A viewable member (the server said `image/*`, `audio/*`, `video/*`) is
 * fetched as a blob and previewed from an object URL — a blob fetch because
 * the password is a header no `<img src>` can carry. Everything else
 * downloads: same blob, an anchor click, the browser's own save flow.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("archiveSheet", …)`.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Alert, Flex, Input, List, Tag, Typography } from "antd";
import { SkinButton as Button } from "@stapel/tokens-antd/skin";
import {
  EmptyState,
  ErrorAlert,
  LoadBoundary,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { fontSize, spacing } from "@stapel/tokens-antd";
import { loadStateFromQuery, useI18n, useT } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import { formatBytes } from "@stapel/docs-react";
import type { ArchiveEntry } from "../api/types.js";
import { useArchiveListing } from "../model/queries.js";
import { useDriveApi } from "../model/context.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { FolderGlyph, MimeGlyph } from "./icons.js";
import { ARCHIVE_PREVIEW_HEIGHT } from "./measure.js";

export interface ArchiveSheetPanelProps {
  /** The zip document being browsed; `null` closes the sheet. */
  readonly documentId: string | null;
  /** The document's name, for the sheet's title. */
  readonly title?: string;
  onClose(): void;
  /** Pin a theme side. Omitted, the document's live mode wins — this is a
   * dialog, which portals out of the tree. */
  readonly mode?: ThemeMode;
}

/** One rung of the local folder illusion: the entries directly under
 * `prefix`, files and (explicit or implied) directories separated. */
export function entriesUnder(
  entries: readonly ArchiveEntry[],
  prefix: string
): { readonly dirs: readonly string[]; readonly files: readonly ArchiveEntry[] } {
  const dirs = new Set<string>();
  const files: ArchiveEntry[] = [];
  for (const entry of entries) {
    if (!entry.path.startsWith(prefix)) continue;
    const rest = entry.path.slice(prefix.length);
    if (rest.length === 0) continue;
    const slash = rest.indexOf("/");
    if (slash === -1) {
      if (entry.is_dir !== true) files.push(entry);
      continue;
    }
    // A deeper path implies every directory on the way — zips are not
    // required to carry explicit directory entries.
    dirs.add(rest.slice(0, slash + 1));
  }
  return { dirs: [...dirs].sort(), files };
}

/** Members the sheet previews inline (the server's guessed type). */
function previewable(mime: string): "image" | "audio" | "video" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return null;
}

interface Preview {
  readonly entry: ArchiveEntry;
  readonly url: string;
  readonly kind: "image" | "audio" | "video";
}

export function ArchiveSheetPanel(props: ArchiveSheetPanelProps): ReactElement {
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <ArchiveSheetBody {...props} />
    </SkinTheme>
  );
}

function ArchiveSheetBody(props: ArchiveSheetPanelProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const api = useDriveApi();
  const listing = useArchiveListing(props.documentId);
  const [path, setPath] = useState("");
  // The ZipCrypto password — component state for the life of the sheet,
  // a header on each extraction, stored nowhere.
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [entryBusy, setEntryBusy] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<StapelApiError | Error | null>(null);

  // A closed sheet forgets everything — the password above all.
  const open = props.documentId !== null;
  useEffect(() => {
    if (!open) {
      setPath("");
      setPassword("");
      setPreview(null);
      setEntryError(null);
    }
  }, [open]);

  // Object URLs are manual memory: release the previous preview's.
  useEffect(
    () => () => {
      if (preview !== null) URL.revokeObjectURL(preview.url);
    },
    [preview]
  );

  const fetchEntry = (entry: ArchiveEntry, mode: "preview" | "download"): void => {
    if (props.documentId === null) return;
    setEntryBusy(entry.path);
    setEntryError(null);
    void api
      .fetchArchiveEntry(props.documentId, entry.path, {
        ...(password.length > 0 ? { password } : {}),
      })
      .then(({ blob, mimeType }) => {
        const kind = previewable(mimeType);
        const url = URL.createObjectURL(blob);
        if (mode === "preview" && kind !== null) {
          setPreview({ entry, url, kind });
          return;
        }
        // The browser's own save flow. The anchor is transient — a stored
        // href over an object URL goes stale in the DOM.
        const anchor = globalThis.document.createElement("a");
        anchor.href = url;
        anchor.download = entry.path.split("/").pop() ?? "entry";
        anchor.click();
        URL.revokeObjectURL(url);
      })
      .catch((error: unknown) => {
        setEntryError(
          error instanceof Error ? error : new Error(String(error))
        );
      })
      .finally(() => {
        setEntryBusy(null);
      });
  };

  const back = (): void => {
    const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
    const up = trimmed.lastIndexOf("/");
    setPath(up === -1 ? "" : trimmed.slice(0, up + 1));
  };

  return (
    <SkinDialog
      open={open}
      onClose={props.onClose}
      title={props.title ?? t(DRIVE_I18N_KEYS.archiveTitle)}
      dismissLabel={t(DRIVE_I18N_KEYS.archiveTitle)}
      data-testid="drive-archive-sheet"
    >
      <LoadBoundary
        state={loadStateFromQuery(listing)}
        onRetry={() => {
          void listing.refetch();
        }}
        testId="drive-archive-listing"
      >
        {(archive) => {
          const { dirs, files } = entriesUnder(archive.entries ?? [], path);
          return (
            <Flex vertical gap={spacing[2]} data-testid="drive-archive-body">
              {archive.archive_encrypted && (
                <Alert
                  type="warning"
                  showIcon
                  data-testid="drive-archive-lock"
                  title={t(DRIVE_I18N_KEYS.archiveLockedBanner)}
                  description={
                    <Input.Password
                      value={password}
                      placeholder={t(DRIVE_I18N_KEYS.archivePasswordField)}
                      aria-label={t(DRIVE_I18N_KEYS.archivePasswordField)}
                      data-testid="drive-archive-password"
                      onChange={(event) => {
                        setPassword(event.target.value);
                      }}
                    />
                  }
                />
              )}

              <ErrorAlert thrown={entryError} testId="drive-archive-entry-error" />

              <Flex align="center" gap={spacing[2]}>
                {path.length > 0 && (
                  <Button
                    type="text"
                    data-testid="drive-archive-back"
                    data-analytics="none"
                    data-analytics-reason="navigation within the sheet — no business outcome to record"
                    onClick={back}
                  >
                    {t(DRIVE_I18N_KEYS.archiveBack)}
                  </Button>
                )}
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: fontSize.xs.fontSize }}
                  data-testid="drive-archive-path"
                >
                  {path.length > 0 ? path : t(DRIVE_I18N_KEYS.archiveRoot)}
                </Typography.Text>
              </Flex>

              {preview !== null && (
                <Flex vertical gap={spacing[2]} data-testid="drive-archive-preview">
                  {preview.kind === "image" ? (
                    <img
                      src={preview.url}
                      alt={preview.entry.path}
                      style={{ maxWidth: "100%", maxHeight: ARCHIVE_PREVIEW_HEIGHT }}
                    />
                  ) : preview.kind === "video" ? (
                    <video
                      src={preview.url}
                      controls
                      playsInline
                      style={{ width: "100%", maxHeight: ARCHIVE_PREVIEW_HEIGHT }}
                    />
                  ) : (
                    <audio src={preview.url} controls style={{ width: "100%" }} />
                  )}
                  <Button
                    type="text"
                    data-testid="drive-archive-preview-close"
                    data-analytics="none"
                    data-analytics-reason="closes the inline preview — no business outcome to record"
                    onClick={() => {
                      setPreview(null);
                    }}
                  >
                    {t(DRIVE_I18N_KEYS.viewerClose)}
                  </Button>
                </Flex>
              )}

              {dirs.length === 0 && files.length === 0 ? (
                <EmptyState
                  compact
                  title={t(DRIVE_I18N_KEYS.archiveEmpty)}
                  testId="drive-archive-empty"
                />
              ) : (
                <List
                  data-testid="drive-archive-entries"
                  dataSource={[
                    ...dirs.map((dir) => ({ kind: "dir" as const, dir })),
                    ...files.map((file) => ({ kind: "file" as const, file })),
                  ]}
                  rowKey={(row) => (row.kind === "dir" ? row.dir : row.file.path)}
                  renderItem={(row) =>
                    row.kind === "dir" ? (
                      <List.Item
                        data-drive-archive-dir={row.dir}
                        style={{ cursor: "pointer" }}
                        data-analytics="none"
                        data-analytics-reason="navigation within the sheet — no business outcome to record"
                        onClick={() => {
                          setPath(path + row.dir);
                        }}
                      >
                        <List.Item.Meta
                          avatar={<FolderGlyph />}
                          title={row.dir.slice(0, -1)}
                          description={t(DRIVE_I18N_KEYS.itemsFolder)}
                        />
                      </List.Item>
                    ) : (
                      <List.Item
                        data-drive-archive-entry={row.file.path}
                        {...(previewable(row.file.mime_type ?? "") !== null
                          ? {
                              style: { cursor: "pointer" },
                              onClick: () => {
                                fetchEntry(row.file, "preview");
                              },
                            }
                          : {})}
                        data-analytics="none"
                        data-analytics-reason="the host app wraps drive interactions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                        actions={[
                          <Button
                            key="download"
                            type="text"
                            size="small"
                            loading={entryBusy === row.file.path}
                            data-testid={`drive-archive-download-${row.file.path}`}
                            data-analytics="none"
                            data-analytics-reason="the host app wraps drive interactions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                            onClick={(event) => {
                              event.stopPropagation();
                              fetchEntry(row.file, "download");
                            }}
                          >
                            {t(DRIVE_I18N_KEYS.archiveDownload)}
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<MimeGlyph mimeType={row.file.mime_type ?? ""} />}
                          title={
                            <Flex gap={spacing[1]} align="center">
                              {row.file.path.split("/").pop()}
                              {row.file.encrypted === true && (
                                <Tag data-testid="drive-archive-locked-tag">
                                  {t(DRIVE_I18N_KEYS.archiveLockedTag)}
                                </Tag>
                              )}
                            </Flex>
                          }
                          description={formatBytes(row.file.size_bytes ?? 0, locale)}
                        />
                      </List.Item>
                    )
                  }
                />
              )}
            </Flex>
          );
        }}
      </LoadBoundary>
    </SkinDialog>
  );
}
