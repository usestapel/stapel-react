/**
 * `<RevisionsModal/>` — the default skin's version-history surface: the
 * `RevisionHistory` headless bag rendered as a dialog with a revision list on
 * the left and a preview on the right, plus rollback (behind a confirm — a
 * rollback lands as a NEW head, history keeps everything) and pin-as-named
 * ("Name this version"). Backed 1:1 by the server's revision routes:
 * list / create / `GET …/:rev/content` (the preview) / `…/:rev/download` /
 * `…/:rev/restore` (the rollback).
 *
 * Text-like revisions preview inline via `useRevisionContent`; a binary
 * document's revisions offer the download link instead (the preview read
 * would decode garbage).
 *
 * The surface is `@stapel/tokens-antd/skin`'s `<SkinDialog>` — a bottom sheet
 * on a phone, a centred modal on tablet/desktop (owner ruling 2026-08-24).
 * `width` is the modal's; the sheet is viewport-wide and ignores it.
 *
 * Self-themed via `DocsSkinTheme` (the dialog inherits the internal
 * `ConfigProvider` through context even across its portal). Replaceable
 * without a fork: `FileManager` resolves this modal through the skin slot
 * registry (`registerDocsSkinComponent("revisionsModal", …)`).
 */
import { useState } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Empty,
  Flex,
  Input,
  List,
  Popconfirm,
  Spin,
  Typography,
} from "antd";
import { SkinDialog } from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  matchList,
  useActionGate,
  useErrorDisplay,
  useT,
} from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { RevisionHistory } from "../headless/RevisionHistory.js";
import { useDocument, useRevisionContent } from "../model/queries.js";
import { useDocsApi } from "../model/context.js";
import type { DocRevision } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { DocsSkinTheme } from "./theme.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface RevisionsModalProps {
  readonly documentId: string;
  readonly open: boolean;
  onClose(): void;
  /** Light or dark; defaults to the host document's declared mode. */
  readonly mode?: ThemeMode;
}

/** Editor hints whose snapshots are text — inline-previewable. */
const TEXT_HINTS = new Set(["text", "markdown", "csv"]);

function RevisionPreview(props: {
  readonly documentId: string;
  readonly revisionId: string;
}): ReactElement {
  const errorDisplay = useErrorDisplay(DOCS_I18N_KEYS.unknownError);
  const query = useRevisionContent(props.documentId, props.revisionId);
  if (query.isLoading) return <Spin />;
  if (query.isError)
    return <ErrorAlert error={errorDisplay(query.error)} testId="docs-revision-preview-error" />;
  return (
    <Typography.Paragraph
      data-testid="docs-revision-preview"
      style={{
        whiteSpace: "pre-wrap",
        maxHeight: 320,
        overflow: "auto",
        marginBottom: 0,
      }}
    >
      {query.data?.text ?? ""}
    </Typography.Paragraph>
  );
}

/**
 * One row's rollback affordance — a component, not a closure, so the gate
 * hook runs at a component's top level rather than inside `renderItem`.
 *
 * The revision the document is CURRENTLY at is not a place to roll back to:
 * the restore would write a new, byte-identical head and a second history
 * entry saying nothing happened. It is switched off through core's
 * `useActionGate` with the reason on screen beside it — the `TrashPane`
 * precedent, because a disabled control receives no pointer events and a
 * tooltip on it is a reason nobody can read.
 */
function RevisionRollback(props: {
  readonly isHead: boolean;
  /** True only while THIS revision is the one being restored. */
  readonly restoring: boolean;
  onConfirm(): void;
}): ReactElement {
  const t = useT();
  const gate = useActionGate(
    props.isHead
      ? actionBlocked(DOCS_I18N_KEYS.revisionsRollbackBlockedHead)
      : actionAvailable()
  );
  const button = (
    <Button
      size="small"
      loading={props.restoring}
      disabled={gate.disabled}
      data-analytics="none"
      data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
    >
      {t(DOCS_I18N_KEYS.revisionsRestore)}
    </Button>
  );
  return (
    <Flex align="center" gap="small">
      {gate.reason !== undefined && (
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12 }}
          data-testid="docs-revision-rollback-blocked"
        >
          {gate.reason}
        </Typography.Text>
      )}
      {gate.disabled ? (
        button
      ) : (
        <Popconfirm
          title={t(DOCS_I18N_KEYS.revisionsRollbackConfirm)}
          okText={t(DOCS_I18N_KEYS.dialogOk)}
          cancelText={t(DOCS_I18N_KEYS.dialogCancel)}
          onConfirm={props.onConfirm}
        >
          {button}
        </Popconfirm>
      )}
    </Flex>
  );
}

export function RevisionsModal(props: RevisionsModalProps): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay(DOCS_I18N_KEYS.unknownError);
  const api = useDocsApi();
  const documentQuery = useDocument(props.documentId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinName, setPinName] = useState("");
  // Which revision the in-flight restore is for. The headless bag exposes one
  // `isRestoring` for the whole mutation, so binding it straight to every
  // row's `loading` spun EVERY button on one rollback.
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const previewable = TEXT_HINTS.has(documentQuery.data?.editor_hint ?? "");
  // The document's current content sequence. `undefined` while the head read
  // is in flight — an unknown head blocks nothing, the same way the preview
  // beside it stays provisional until the read lands.
  const headSeq = documentQuery.data?.head_seq;

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
    <DocsSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <SkinDialog
        open={props.open}
        title={t(DOCS_I18N_KEYS.revisionsTitle)}
        dismissLabel={t(DOCS_I18N_KEYS.dialogClose)}
        width={720}
        onClose={() => {
          props.onClose();
        }}
      >
        <RevisionHistory documentId={props.documentId}>
          {({
            state,
            createRevision,
            isCreating,
            createError,
            restore,
            isRestoring,
            restoreError,
          }) => (
            <Flex vertical gap="middle" data-testid="docs-revisions-modal">
              {(createError ?? restoreError) !== null && (
                <ErrorAlert
                  error={errorDisplay(createError ?? restoreError)}
                  testId="docs-revisions-error"
                />
              )}

              <Flex gap="small">
                <Input
                  size="small"
                  placeholder={t(DOCS_I18N_KEYS.revisionsNamePlaceholder)}
                  value={pinName}
                  onChange={(event) => {
                    setPinName(event.target.value);
                  }}
                />
                <Button
                  size="small"
                  loading={isCreating}
                  disabled={pinName.trim().length === 0}
                  onClick={() => {
                    createRevision(pinName.trim());
                    setPinName("");
                  }}
                  data-analytics="none"
                  data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                >
                  {t(DOCS_I18N_KEYS.revisionsCreate)}
                </Button>
              </Flex>

              <Flex gap="middle" align="flex-start">
                <div style={{ flex: "0 0 45%" }}>
                  {matchList(state, {
                    loading: () => <Spin />,
                    failed: (error) => (
                      <ErrorAlert
                        error={errorDisplay(error)}
                        testId="docs-revisions-load-error"
                      />
                    ),
                    empty: () => (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t(DOCS_I18N_KEYS.revisionsEmpty)}
                      />
                    ),
                    ready: (revisions) => (
                    <List<DocRevision>
                      size="small"
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
                                headSeq !== undefined && revision.seq === headSeq
                              }
                              restoring={isRestoring && restoringId === revision.id}
                              onConfirm={() => {
                                setRestoringId(revision.id);
                                restore(revision.id);
                              }}
                            />,
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              revision.name ??
                              t(DOCS_I18N_KEYS.revisionsAutomatic)
                            }
                            description={
                              <Typography.Text
                                type="secondary"
                                style={{ fontSize: 12 }}
                              >
                                {new Date(revision.created_at).toLocaleString()}
                              </Typography.Text>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    ),
                  })}
                </div>

                <div style={{ flex: "1 1 55%" }}>
                  {selectedId === null ? (
                    <Typography.Text type="secondary">
                      {t(DOCS_I18N_KEYS.revisionsPreviewEmpty)}
                    </Typography.Text>
                  ) : previewable ? (
                    <RevisionPreview
                      documentId={props.documentId}
                      revisionId={selectedId}
                    />
                  ) : (
                    <Flex vertical gap="small">
                      <Typography.Text type="secondary">
                        {t(DOCS_I18N_KEYS.revisionsPreviewBinary)}
                      </Typography.Text>
                      <Button
                        size="small"
                        onClick={() => {
                          downloadRevision(selectedId);
                        }}
                        data-analytics="none"
                        data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                      >
                        {t(DOCS_I18N_KEYS.revisionsDownload)}
                      </Button>
                    </Flex>
                  )}
                </div>
              </Flex>
            </Flex>
          )}
        </RevisionHistory>
      </SkinDialog>
    </DocsSkinTheme>
  );
}
