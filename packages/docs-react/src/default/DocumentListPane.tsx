/**
 * `<DocumentListPane/>` — the default skin's document list: the
 * `DocumentList` headless bag rendered as an antd `List` through core's
 * `matchList` (four required arms — "no documents yet" is only said about a
 * read that succeeded), one row per document, with a right-click context
 * menu (open / rename / move / version history / download / move to trash —
 * every operation stapel-docs exposes for a live document; there is no
 * duplicate endpoint, so no duplicate item). Left click opens the document
 * via `onOpenDocument`.
 *
 * At the workspace root (`folderId: null`) the pane lists UNFILED documents:
 * the backend's list read has no is-null filter (omitting `folder_id` means
 * "everything in the workspace"), so the root scope is projected client-side
 * off that same read — file-manager semantics, not a hidden second endpoint.
 *
 * Replaceable without a fork: `FileManager` resolves this pane through the
 * skin slot registry (`registerDocsSkinComponent("fileManager.listPane", …)`).
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Dropdown, Empty, Flex, List, Spin, Typography } from "antd";
import {
  loadStateFromQuery,
  loadedRowsOrEmpty,
  mapLoad,
  matchList,
  useErrorDisplay,
  useT,
} from "@stapel/core";
import { DocumentList } from "../headless/DocumentList.js";
import { useFolders } from "../model/queries.js";
import {
  useExportUrl,
  useTrashDocument,
  useUpdateDocument,
} from "../model/mutations.js";
import type { DocDocument } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { MoveDialog, NameDialog } from "./dialogs.js";

export interface DocumentListPaneProps {
  readonly workspaceId: string;
  /** The folder scope, `null` for the workspace root (unfiled documents). */
  readonly folderId: string | null;
  /** Full-text query (the host's search box). */
  readonly q?: string;
  /** Left click / "Open" on a row. */
  onOpenDocument?(doc: DocDocument): void;
  /** "Version history" on a row (the composing surface owns the modal);
   * omitted → the menu item is not offered. */
  onShowHistory?(doc: DocDocument): void;
}

type DialogState =
  | { readonly kind: "rename"; readonly doc: DocDocument }
  | { readonly kind: "move"; readonly doc: DocDocument }
  | null;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentListPane(props: DocumentListPaneProps): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay(DOCS_I18N_KEYS.unknownError);
  const [dialog, setDialog] = useState<DialogState>(null);
  const foldersQuery = useFolders(props.workspaceId);
  const updateDocument = useUpdateDocument();
  const trashDocument = useTrashDocument();
  const exportUrl = useExportUrl();

  // Destination options for the move dialog — a picker input, not the
  // discriminating render (that is `matchList` below), so the sanctioned
  // non-discriminating projection is exactly right here.
  const moveTargets = loadedRowsOrEmpty(loadStateFromQuery(foldersQuery));

  const busy = updateDocument.isPending || trashDocument.isPending;
  const mutationError =
    updateDocument.error ?? trashDocument.error ?? exportUrl.error ?? null;

  function download(doc: DocDocument): void {
    exportUrl.mutate(
      { documentId: doc.id },
      {
        onSuccess: (url) => {
          window.open(url, "_blank", "noopener");
        },
      }
    );
  }

  function row(doc: DocDocument): ReactNode {
    return (
      <Dropdown
        trigger={["contextMenu"]}
        menu={{
          items: [
            { key: "open", label: t(DOCS_I18N_KEYS.menuOpen) },
            { key: "rename", label: t(DOCS_I18N_KEYS.menuRename) },
            { key: "move", label: t(DOCS_I18N_KEYS.menuMove) },
            ...(props.onShowHistory
              ? [{ key: "history", label: t(DOCS_I18N_KEYS.menuHistory) }]
              : []),
            { key: "download", label: t(DOCS_I18N_KEYS.menuDownload) },
            { type: "divider" as const },
            {
              key: "trash",
              label: t(DOCS_I18N_KEYS.menuMoveToTrash),
              danger: true,
            },
          ],
          onClick: ({ key }) => {
            if (key === "open") props.onOpenDocument?.(doc);
            else if (key === "rename") setDialog({ kind: "rename", doc });
            else if (key === "move") setDialog({ kind: "move", doc });
            else if (key === "history") props.onShowHistory?.(doc);
            else if (key === "download") download(doc);
            else if (key === "trash") trashDocument.mutate(doc.id);
          },
        }}
      >
        <List.Item
          data-docs-document={doc.id}
          style={{ cursor: "pointer" }}
          onClick={() => {
            props.onOpenDocument?.(doc);
          }}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        >
          <List.Item.Meta
            title={doc.title}
            description={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(doc.updated_at).toLocaleDateString()}
                {" · "}
                {formatSize(doc.size_bytes)}
              </Typography.Text>
            }
          />
        </List.Item>
      </Dropdown>
    );
  }

  const emptyList = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={t(DOCS_I18N_KEYS.listEmpty)}
    />
  );

  return (
    <DocumentList
      workspaceId={props.workspaceId}
      {...(props.folderId !== null ? { folderId: props.folderId } : {})}
      {...(props.q !== undefined ? { q: props.q } : {})}
    >
      {({ state }) => (
        <Flex vertical gap="small" data-testid="docs-document-list-pane">
          {mutationError !== null && (
            <ErrorAlert
              error={errorDisplay(mutationError)}
              testId="docs-list-error"
            />
          )}

          {matchList(
            // Root scope = unfiled documents, projected off the same read.
            mapLoad(state, (documents) =>
              props.folderId === null
                ? documents.filter((doc) => doc.folder_id === null)
                : documents
            ),
            {
              loading: () => <Spin />,
              failed: (error) => (
                <ErrorAlert
                  error={errorDisplay(error)}
                  testId="docs-list-load-error"
                />
              ),
              empty: () => emptyList,
              ready: (documents) => (
                <List<DocDocument>
                  dataSource={[...documents]}
                  rowKey={(doc) => doc.id}
                  renderItem={row}
                />
              ),
            }
          )}

          <NameDialog
            open={dialog?.kind === "rename"}
            titleKey={DOCS_I18N_KEYS.dialogRenameTitle}
            initialValue={dialog?.kind === "rename" ? dialog.doc.title : ""}
            busy={busy}
            onConfirm={(title) => {
              if (dialog?.kind === "rename") {
                updateDocument.mutate(
                  { documentId: dialog.doc.id, patch: { title } },
                  { onSuccess: () => setDialog(null) }
                );
              }
            }}
            onClose={() => setDialog(null)}
          />

          <MoveDialog
            open={dialog?.kind === "move"}
            folders={moveTargets}
            currentParentId={
              dialog?.kind === "move" ? dialog.doc.folder_id : null
            }
            busy={busy}
            onConfirm={(destinationId) => {
              if (dialog?.kind === "move") {
                updateDocument.mutate(
                  {
                    documentId: dialog.doc.id,
                    patch: { folder_id: destinationId },
                  },
                  { onSuccess: () => setDialog(null) }
                );
              }
            }}
            onClose={() => setDialog(null)}
          />
        </Flex>
      )}
    </DocumentList>
  );
}
