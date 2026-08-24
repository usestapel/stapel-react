/**
 * `<DocumentListPane/>` — the default skin's document list: the
 * `DocumentList` headless bag rendered as an antd `List` through the shared
 * `<LoadList>` (four arms, "no documents yet" said only about a read that
 * SUCCEEDED), one row per document, with the operations stapel-docs exposes
 * for a live document — open / rename / move / version history / download /
 * move to trash. There is no duplicate endpoint, so there is no duplicate
 * item.
 *
 * ── Two ways into the menu, on purpose ────────────────────────────────────
 *
 * The menu used to be `trigger={["contextMenu"]}` alone: rename, move, trash,
 * download and history were reachable only by right-clicking, i.e. not at all
 * by keyboard and not at all on touch. Every row now carries a visible
 * actions button as well — the same menu, opened by click, focusable and
 * named — and the right-click stays for the people who expect it.
 *
 * ── Controls that do nothing are not offered ──────────────────────────────
 *
 * "Open" and the row click both route through `onOpenDocument`, which a host
 * may not pass. When it does not, neither is rendered — the same rule
 * "Version history" already followed. A row that looks clickable and answers
 * nothing is the §83 defect.
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
import { Dropdown, Flex, List, Typography } from "antd";
import { EmptyState, ErrorAlert, LoadList } from "@stapel/tokens-antd/skin";
import {
  loadStateFromQuery,
  loadedRowsOrEmpty,
  mapLoad,
  useI18n,
  useT,
} from "@stapel/core";
import { fontSize } from "@stapel/tokens";
import { DocumentList } from "../headless/DocumentList.js";
import { useFolders } from "../model/queries.js";
import {
  useExportUrl,
  useTrashDocument,
  useUpdateDocument,
} from "../model/mutations.js";
import { formatBytes, formatDate } from "../model/format.js";
import type { DocDocument } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { MoveDialog, NameDialog } from "./dialogs.js";

export interface DocumentListPaneProps {
  readonly workspaceId: string;
  /** The folder scope, `null` for the workspace root (unfiled documents). */
  readonly folderId: string | null;
  /** Full-text query (the host's search box). */
  readonly q?: string;
  /** Row click / "Open" on a row. Omitted → neither affordance is rendered. */
  onOpenDocument?(doc: DocDocument): void;
  /** "Version history" on a row (the composing surface owns the modal);
   * omitted → the menu item is not offered. */
  onShowHistory?(doc: DocDocument): void;
}

type DialogState =
  | { readonly kind: "rename"; readonly doc: DocDocument }
  | { readonly kind: "move"; readonly doc: DocDocument }
  | null;

export function DocumentListPane(props: DocumentListPaneProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const [dialog, setDialog] = useState<DialogState>(null);
  const foldersQuery = useFolders(props.workspaceId);
  const updateDocument = useUpdateDocument();
  const trashDocument = useTrashDocument();
  const exportUrl = useExportUrl();

  // Destination options for the move dialog — a picker input, not the
  // discriminating render (that is `LoadList` below), so the sanctioned
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

  function menuItems(): { readonly key: string; readonly label?: ReactNode; readonly type?: "divider"; readonly danger?: boolean }[] {
    return [
      ...(props.onOpenDocument
        ? [{ key: "open", label: t(DOCS_I18N_KEYS.menuOpen) }]
        : []),
      { key: "rename", label: t(DOCS_I18N_KEYS.menuRename) },
      { key: "move", label: t(DOCS_I18N_KEYS.menuMove) },
      ...(props.onShowHistory
        ? [{ key: "history", label: t(DOCS_I18N_KEYS.menuHistory) }]
        : []),
      { key: "download", label: t(DOCS_I18N_KEYS.menuDownload) },
      { type: "divider" as const, key: "sep" },
      {
        key: "trash",
        label: t(DOCS_I18N_KEYS.menuMoveToTrash),
        danger: true,
      },
    ];
  }

  function onMenuClick(doc: DocDocument, key: string): void {
    if (key === "open") props.onOpenDocument?.(doc);
    else if (key === "rename") setDialog({ kind: "rename", doc });
    else if (key === "move") setDialog({ kind: "move", doc });
    else if (key === "history") props.onShowHistory?.(doc);
    else if (key === "download") download(doc);
    else if (key === "trash") trashDocument.mutate(doc.id);
  }

  function row(doc: DocDocument): ReactNode {
    const menu = {
      items: menuItems(),
      onClick: ({ key }: { key: string }) => {
        onMenuClick(doc, key);
      },
    };
    const openable = props.onOpenDocument !== undefined;
    return (
      <Dropdown trigger={["contextMenu"]} menu={menu}>
        <List.Item
          data-docs-document={doc.id}
          {...(openable
            ? {
                style: { cursor: "pointer" },
                onClick: () => {
                  props.onOpenDocument?.(doc);
                },
              }
            : {})}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          actions={[
            <Dropdown key="actions" trigger={["click"]} menu={menu}>
              <Typography.Link
                aria-label={t(DOCS_I18N_KEYS.menuActions)}
                data-docs-row-actions={doc.id}
                onClick={(event) => {
                  // The row itself may open the document; the menu must not.
                  event.stopPropagation();
                }}
                data-analytics="none"
                data-analytics-reason="opens a menu — the chosen item carries the tracked action"
              >
                {t(DOCS_I18N_KEYS.menuActions)}
              </Typography.Link>
            </Dropdown>,
          ]}
        >
          <List.Item.Meta
            title={doc.title}
            description={
              <Typography.Text
                type="secondary"
                style={{ fontSize: fontSize.xs.fontSize }}
              >
                {formatDate(doc.updated_at, locale)}
                {" · "}
                {formatBytes(doc.size_bytes, locale)}
              </Typography.Text>
            }
          />
        </List.Item>
      </Dropdown>
    );
  }

  return (
    <DocumentList
      workspaceId={props.workspaceId}
      {...(props.folderId !== null ? { folderId: props.folderId } : {})}
      {...(props.q !== undefined ? { q: props.q } : {})}
    >
      {({ state, refetch }) => (
        <Flex vertical gap="small" data-testid="docs-document-list-pane">
          <ErrorAlert thrown={mutationError} testId="docs-list-error" />

          <LoadList
            // Root scope = unfiled documents, projected off the same read.
            state={mapLoad(state, (documents) =>
              props.folderId === null
                ? documents.filter((doc) => (doc.folder_id ?? null) === null)
                : documents
            )}
            onRetry={refetch}
            testId="docs-list"
            empty={
              <EmptyState
                title={t(DOCS_I18N_KEYS.listEmpty)}
                hint={t(DOCS_I18N_KEYS.listEmptyHint)}
                testId="docs-list-empty"
              />
            }
          >
            {(documents) => (
              <List<DocDocument>
                dataSource={[...documents]}
                rowKey={(doc) => doc.id}
                renderItem={row}
              />
            )}
          </LoadList>

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
              dialog?.kind === "move" ? dialog.doc.folder_id ?? null : null
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
