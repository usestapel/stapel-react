/**
 * `<RevisionsModal/>` — the default skin's version-history surface: the
 * `RevisionHistory` headless bag rendered as a dialog with the revision list
 * and a preview, plus rollback (behind a confirmation — a rollback lands as a
 * NEW head, history keeps everything) and pin-as-named ("Name this version").
 * Backed 1:1 by the server's revision routes: list / create /
 * `GET …/:rev/content` (the preview) / `…/:rev/download` / `…/:rev/restore`.
 *
 * Text-like revisions preview inline via `useRevisionContent`; a binary
 * document's revisions offer the download link instead (the preview read
 * would decode garbage).
 *
 * The surface is `@stapel/tokens-antd/skin`'s `<SkinDialog>` — a bottom sheet
 * on a phone, a centred modal on tablet/desktop (owner ruling 2026-08-24) —
 * and the two panes inside it STACK on a narrow one, measured off the dialog
 * body's own width rather than the viewport. `width` is the modal's; the
 * sheet is viewport-wide and ignores it.
 *
 * Replaceable without a fork: `FileManager` resolves this modal through the
 * skin slot registry (`registerDocsSkinComponent("revisionsModal", …)`).
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Input, List, Typography } from "antd";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  LoadList,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  mapLoad,
  useI18n,
  useT,
} from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { fontSize, spacing } from "@stapel/tokens";
import { RevisionHistory } from "../headless/RevisionHistory.js";
import { useDocument, useRevisionContent } from "../model/queries.js";
import { useDocsApi } from "../model/context.js";
import { formatDateTime } from "../model/format.js";
import type { DocRevision } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { useSplitLayout } from "./useSplitLayout.js";
import { ROW_REASON_MEASURE } from "./measure.js";

export interface RevisionsModalProps {
  readonly documentId: string;
  readonly open: boolean;
  onClose(): void;
  /** Light or dark; defaults to the host document's live declared mode. */
  readonly mode?: ThemeMode;
}

/** Editor hints whose snapshots are text — inline-previewable. */
const TEXT_HINTS = new Set(["text", "markdown", "csv"]);

/** The media half of a revision preview: an `image/*`, `audio/*` or
 * `video/*` file document previews an OLD revision through the authorized
 * revision content stream (`api.revisionContentUrl`) — the browser's own
 * loader carries the session cookie exactly as the thumbnail endpoint's
 * does, and the stream answers Range since stapel-docs 0.8.0, so a video
 * revision can seek. */
function mediaKindOf(mimeType: string): "image" | "audio" | "video" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

function RevisionMediaPreview(props: {
  readonly url: string;
  readonly kind: "image" | "audio" | "video";
  readonly title: string;
}): ReactElement {
  const style = {
    maxWidth: "100%",
    maxHeight: PREVIEW_MAX_HEIGHT,
  } as const;
  return props.kind === "image" ? (
    <img
      src={props.url}
      alt={props.title}
      data-testid="docs-revision-media"
      style={style}
    />
  ) : props.kind === "video" ? (
    <video
      src={props.url}
      controls
      preload="metadata"
      data-testid="docs-revision-media"
      style={style}
    />
  ) : (
    <audio
      src={props.url}
      controls
      preload="metadata"
      data-testid="docs-revision-media"
      style={{ width: "100%" }}
    />
  );
}

/** The dialog's width on tablet/desktop: two panes side by side. A one-off
 * geometry (no spacing step is a dialog width), named so it changes once. */
export const REVISIONS_MODAL_WIDTH: number = 720;
/** How tall an inline revision preview grows before it scrolls. */
const PREVIEW_MAX_HEIGHT = spacing[8] * 5;

function RevisionPreview(props: {
  readonly documentId: string;
  readonly revisionId: string;
}): ReactElement {
  const query = useRevisionContent(props.documentId, props.revisionId);
  return (
    <LoadBoundary
      state={mapLoad(loadStateFromQuery(query), (content) => content.text)}
      onRetry={() => {
        void query.refetch();
      }}
      testId="docs-revision-preview-state"
    >
      {(text) => (
        <Typography.Paragraph
          data-testid="docs-revision-preview"
          style={{
            whiteSpace: "pre-wrap",
            maxHeight: PREVIEW_MAX_HEIGHT,
            overflow: "auto",
            marginBottom: 0,
          }}
        >
          {text}
        </Typography.Paragraph>
      )}
    </LoadBoundary>
  );
}

export function RevisionsModal(props: RevisionsModalProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const api = useDocsApi();
  // A modal a host mounted beside a row but nobody opened reads NOTHING
  // (upstream tail of the drive wave): both reads are gated on `open`.
  const documentQuery = useDocument(props.documentId, {
    enabled: props.open,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinName, setPinName] = useState("");
  const [rollbackTo, setRollbackTo] = useState<DocRevision | null>(null);
  // Which revision the in-flight restore is for. The headless bag exposes one
  // `isRestoring` for the whole mutation, so binding it straight to every
  // row's `loading` spun EVERY button on one rollback.
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { containerRef, stacked } = useSplitLayout();

  const previewable = TEXT_HINTS.has(documentQuery.data?.editor_hint ?? "");
  // A media file document's revisions preview through the content stream —
  // null for text and for genuinely opaque binaries (those keep the
  // download link).
  const mediaKind =
    documentQuery.data !== undefined && documentQuery.data.type === "file"
      ? mediaKindOf(documentQuery.data.mime_type)
      : null;
  // The document's current content sequence. `undefined` while the head read
  // is in flight — an unknown head blocks nothing, the same way the preview
  // beside it stays provisional until the read lands.
  const headSeq = documentQuery.data?.head_seq;

  const trimmedPin = pinName.trim();
  const pinGate =
    trimmedPin.length === 0
      ? actionBlocked(DOCS_I18N_KEYS.revisionsNameBlockedEmpty)
      : actionAvailable();

  function downloadRevision(revisionId: string): void {
    void (async () => {
      const download = await api.getRevisionDownloadUrl(
        props.documentId,
        revisionId
      );
      window.open(download.url, "_blank", "noopener");
    })();
  }

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <SkinDialog
        open={props.open}
        title={t(DOCS_I18N_KEYS.revisionsTitle)}
        dismissLabel={t(DOCS_I18N_KEYS.dialogClose)}
        width={REVISIONS_MODAL_WIDTH}
        onClose={() => {
          props.onClose();
        }}
      >
        <RevisionHistory documentId={props.documentId} enabled={props.open}>
          {({
            state,
            createRevision,
            isCreating,
            createError,
            refetch,
            restore,
            isRestoring,
            restoreError,
          }) => (
            <Flex vertical gap="middle" data-testid="docs-revisions-modal">
              <ErrorAlert
                thrown={createError ?? restoreError}
                testId="docs-revisions-error"
              />

              <Flex gap="small" align="flex-start" wrap>
                <Input
                  data-testid="docs-revision-name"
                  placeholder={t(DOCS_I18N_KEYS.revisionsNamePlaceholder)}
                  value={pinName}
                  onChange={(event) => {
                    setPinName(event.target.value);
                  }}
                />
                <GatedButton
                  gate={pinGate}
                  loading={isCreating}
                  onClick={() => {
                    createRevision(trimmedPin);
                    setPinName("");
                  }}
                  testId="docs-revision-create"
                  data-analytics="none"
                  data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                >
                  {t(DOCS_I18N_KEYS.revisionsCreate)}
                </GatedButton>
              </Flex>

              <div ref={containerRef}>
                <Flex
                  gap="middle"
                  align="flex-start"
                  vertical={stacked}
                  data-testid="docs-revisions-split"
                >
                  <div style={{ flex: stacked ? "1 1 auto" : "0 0 45%", minWidth: 0, width: "100%" }}>
                    <LoadList
                      state={state}
                      onRetry={refetch}
                      testId="docs-revisions-list"
                      empty={
                        <EmptyState
                          compact
                          title={t(DOCS_I18N_KEYS.revisionsEmpty)}
                          testId="docs-revisions-empty"
                        />
                      }
                    >
                      {(revisions) => (
                        <List<DocRevision>
                          dataSource={[...revisions]}
                          rowKey={(revision) => revision.id}
                          renderItem={(revision) => (
                            <List.Item
                              data-docs-revision={revision.id}
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setSelectedId(revision.id);
                              }}
                              data-analytics="none"
                              data-analytics-reason="selection within the dialog — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                              actions={[
                                <RevisionRollback
                                  key="rollback"
                                  isHead={
                                    headSeq !== undefined &&
                                    revision.seq === headSeq
                                  }
                                  restoring={
                                    isRestoring && restoringId === revision.id
                                  }
                                  onAsk={() => {
                                    setRollbackTo(revision);
                                  }}
                                />,
                              ]}
                            >
                              <List.Item.Meta
                                title={
                                  revision.name.length > 0
                                    ? revision.name
                                    : t(DOCS_I18N_KEYS.revisionsAutomatic)
                                }
                                description={
                                  <Typography.Text
                                    type="secondary"
                                    style={{ fontSize: fontSize.xs.fontSize }}
                                  >
                                    {formatDateTime(revision.created_at, locale)}
                                  </Typography.Text>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      )}
                    </LoadList>
                  </div>

                  <div style={{ flex: stacked ? "1 1 auto" : "1 1 55%", minWidth: 0, width: "100%" }}>
                    {selectedId === null ? (
                      <Typography.Text type="secondary">
                        {t(DOCS_I18N_KEYS.revisionsPreviewEmpty)}
                      </Typography.Text>
                    ) : previewable ? (
                      <RevisionPreview
                        documentId={props.documentId}
                        revisionId={selectedId}
                      />
                    ) : mediaKind !== null ? (
                      <RevisionMediaPreview
                        url={api.revisionContentUrl(props.documentId, selectedId)}
                        kind={mediaKind}
                        title={documentQuery.data?.title ?? ""}
                      />
                    ) : (
                      <Flex vertical gap="small" align="flex-start">
                        <Typography.Text type="secondary">
                          {t(DOCS_I18N_KEYS.revisionsPreviewBinary)}
                        </Typography.Text>
                        <GatedButton
                          gate={actionAvailable()}
                          onClick={() => {
                            downloadRevision(selectedId);
                          }}
                          testId="docs-revision-download"
                          data-analytics="none"
                          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                        >
                          {t(DOCS_I18N_KEYS.revisionsDownload)}
                        </GatedButton>
                      </Flex>
                    )}
                  </div>
                </Flex>
              </div>

              <SkinConfirm
                open={rollbackTo !== null}
                title={t(DOCS_I18N_KEYS.revisionsRollbackConfirm)}
                {...(rollbackTo !== null && rollbackTo.name.length > 0
                  ? { body: rollbackTo.name }
                  : {})}
                confirmLabel={t(DOCS_I18N_KEYS.revisionsRestore)}
                confirming={isRestoring}
                onConfirm={() => {
                  if (rollbackTo !== null) {
                    setRestoringId(rollbackTo.id);
                    restore(rollbackTo.id);
                  }
                  setRollbackTo(null);
                }}
                onCancel={() => {
                  setRollbackTo(null);
                }}
                data-testid="docs-revision-rollback-confirm"
              />
            </Flex>
          )}
        </RevisionHistory>
      </SkinDialog>
    </SkinTheme>
  );
}

/**
 * One row's rollback affordance — a component, not a closure, so the gate
 * hook runs at a component's top level rather than inside `renderItem`.
 *
 * The revision the document is CURRENTLY at is not a place to roll back to:
 * the restore would write a new, byte-identical head and a second history
 * entry saying nothing happened. `GatedButton` switches it off WITH the
 * reason beside it — a disabled control receives no pointer events, so a
 * tooltip on it is a reason nobody can read.
 */
/**
 * "Restore", with the one reason it can be off under it.
 *
 * Stacked, not inline: this button lives in a `List.Item`'s action slot, and
 * an inline reason there ran "This is the document's current version." past
 * the right edge of a 390px sheet and cut the row in half (visual pass M-4).
 */
function RevisionRollback(props: {
  readonly isHead: boolean;
  /** True only while THIS revision is the one being restored. */
  readonly restoring: boolean;
  onAsk(): void;
}): ReactElement {
  const t = useT();
  return (
    <GatedButton
      gate={
        props.isHead
          ? actionBlocked(DOCS_I18N_KEYS.revisionsRollbackBlockedHead)
          : actionAvailable()
      }
      wrapperStyle={{ flexWrap: "nowrap", maxWidth: ROW_REASON_MEASURE }}
      loading={props.restoring}
      onClick={props.onAsk}
      testId="docs-revision-rollback"
      data-analytics="none"
      data-analytics-reason="opens the rollback confirmation — the confirmed restore carries the tracked action"
    >
      {t(DOCS_I18N_KEYS.revisionsRestore)}
    </GatedButton>
  );
}
