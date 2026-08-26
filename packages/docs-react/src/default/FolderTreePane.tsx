/**
 * `<FolderTreePane/>` — the default skin's folder tree: the `FolderTree`
 * headless bag rendered as an antd `Tree` through the shared `<LoadBoundary>`
 * (loading and failed arms designed once; "no folders yet" said only about a
 * read that succeeded), with the operations stapel-docs exposes per folder —
 * rename / move / new subfolder / move to trash — and a "New folder" header
 * button. Selection is controlled by the composing surface (`FileManager`
 * keeps the current folder).
 *
 * Like the document list, every folder carries a visible, focusable actions
 * trigger as well as the right-click menu: a menu reachable only by
 * right-click is a menu no keyboard and no phone can open.
 *
 * Replaceable without a fork: `FileManager` resolves this pane through the
 * skin slot registry (`registerDocsSkinComponent("fileManager.treePane", …)`).
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Dropdown, Flex, Tree, Typography } from "antd";
import type { TreeDataNode } from "antd";
import {
  EmptyState,
  ErrorAlert,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { FolderTree } from "../headless/FolderTree.js";
import type { FolderTreeView } from "../headless/FolderTree.js";
import type { FolderTreeNode } from "../model/folderTree.js";
import {
  useCreateFolder,
  useTrashFolder,
  useUpdateFolder,
} from "../model/mutations.js";
import type { DocFolder } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { MoveDialog, NameDialog } from "./dialogs.js";
import { RowActions } from "./RowActions.js";

export interface FolderTreePaneProps {
  readonly workspaceId: string;
  /** The selected folder, `null` for the workspace root. */
  readonly selectedFolderId: string | null;
  onSelectFolder(folderId: string | null): void;
  /** Pin a theme side. Omitted, the document's live mode wins — the pane
   * self-themes, and its dialogs portal out of this tree. */
  readonly mode?: ThemeMode;
}

type DialogState =
  | { readonly kind: "rename"; readonly folder: DocFolder }
  | { readonly kind: "move"; readonly folder: DocFolder }
  | { readonly kind: "newFolder"; readonly parentId: string | null }
  | null;

/** The folder's own id plus every descendant's — the ids a move dialog must
 * not offer as a destination. */
function subtreeIds(node: FolderTreeNode): string[] {
  return [node.folder.id, ...node.children.flatMap(subtreeIds)];
}

function findNode(
  nodes: readonly FolderTreeNode[],
  folderId: string
): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.folder.id === folderId) return node;
    const inChildren = findNode(node.children, folderId);
    if (inChildren) return inChildren;
  }
  return null;
}

export function FolderTreePane(props: FolderTreePaneProps): ReactElement {
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <FolderTreePaneBody {...props} />
    </SkinTheme>
  );
}

function FolderTreePaneBody(props: FolderTreePaneProps): ReactElement {
  const t = useT();
  const [dialog, setDialog] = useState<DialogState>(null);
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const trashFolder = useTrashFolder();

  const busy =
    createFolder.isPending || updateFolder.isPending || trashFolder.isPending;
  const mutationError =
    createFolder.error ?? updateFolder.error ?? trashFolder.error ?? null;

  function onMenuClick(folder: DocFolder, key: string): void {
    if (key === "rename") setDialog({ kind: "rename", folder });
    else if (key === "move") setDialog({ kind: "move", folder });
    else if (key === "newSubfolder")
      setDialog({ kind: "newFolder", parentId: folder.id });
    else if (key === "trash") trashFolder.mutate(folder.id);
  }

  function nodeTitle(folder: DocFolder): ReactNode {
    const menu = {
      items: [
        { key: "rename", label: t(DOCS_I18N_KEYS.menuRename) },
        { key: "move", label: t(DOCS_I18N_KEYS.menuMove) },
        { key: "newSubfolder", label: t(DOCS_I18N_KEYS.menuNewSubfolder) },
        { type: "divider" as const, key: "sep" },
        {
          key: "trash",
          label: t(DOCS_I18N_KEYS.menuMoveToTrash),
          danger: true,
        },
      ],
      onClick: ({ key }: { key: string }) => {
        onMenuClick(folder, key);
      },
    };
    return (
      <Dropdown trigger={["contextMenu"]} menu={menu}>
        <Flex align="center" justify="space-between" gap="small">
          <Typography.Text data-docs-folder={folder.id}>
            {folder.name}
          </Typography.Text>
          <RowActions
            menu={menu}
            label={t(DOCS_I18N_KEYS.menuActions)}
            dataAttribute={{ "data-docs-folder-actions": folder.id }}
            stopPropagation
          />
        </Flex>
      </Dropdown>
    );
  }

  function toTreeData(nodes: readonly FolderTreeNode[]): TreeDataNode[] {
    return nodes.map((node) => ({
      key: node.folder.id,
      title: nodeTitle(node.folder),
      children: toTreeData(node.children),
    }));
  }

  function renderTree(view: FolderTreeView): ReactElement {
    if (view.tree.length === 0) {
      return (
        <EmptyState
          compact
          title={t(DOCS_I18N_KEYS.managerFoldersEmpty)}
          testId="docs-tree-empty"
        />
      );
    }
    return (
      <Tree
        blockNode
        defaultExpandAll
        treeData={toTreeData(view.tree)}
        selectedKeys={
          props.selectedFolderId !== null ? [props.selectedFolderId] : []
        }
        onSelect={(keys) => {
          const first = keys[0];
          props.onSelectFolder(typeof first === "string" ? first : null);
        }}
      />
    );
  }

  return (
    <FolderTree workspaceId={props.workspaceId}>
      {({ state, refetch }) => {
        // The dialogs need the flat list / tree for the destination picker
        // and the cycle exclusion. They only OPEN from a rendered node, i.e.
        // from the ready arm — outside it, empty inputs are honest.
        const view: FolderTreeView =
          state.status === "ready" ? state.data : { tree: [], folders: [] };
        return (
          <Flex vertical gap="small" data-testid="docs-folder-tree-pane">
            <Button
              block
              onClick={() => {
                setDialog({ kind: "newFolder", parentId: null });
              }}
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            >
              {t(DOCS_I18N_KEYS.managerNewFolder)}
            </Button>

            <ErrorAlert thrown={mutationError} testId="docs-tree-error" />

            <LoadBoundary
              state={state}
              onRetry={refetch}
              testId="docs-tree"
            >
              {renderTree}
            </LoadBoundary>

            <NameDialog
              open={dialog?.kind === "rename" || dialog?.kind === "newFolder"}
              titleKey={
                dialog?.kind === "newFolder"
                  ? DOCS_I18N_KEYS.dialogNewFolderTitle
                  : DOCS_I18N_KEYS.dialogRenameTitle
              }
              confirmKey={
                dialog?.kind === "newFolder"
                  ? DOCS_I18N_KEYS.dialogCreateFolderConfirm
                  : DOCS_I18N_KEYS.dialogRenameConfirm
              }
              initialValue={dialog?.kind === "rename" ? dialog.folder.name : ""}
              busy={busy}
              onConfirm={(name) => {
                if (dialog?.kind === "rename") {
                  updateFolder.mutate(
                    { folderId: dialog.folder.id, patch: { name } },
                    { onSuccess: () => setDialog(null) }
                  );
                } else if (dialog?.kind === "newFolder") {
                  createFolder.mutate(
                    {
                      workspace_id: props.workspaceId,
                      name,
                      parent_id: dialog.parentId,
                    },
                    { onSuccess: () => setDialog(null) }
                  );
                }
              }}
              onClose={() => setDialog(null)}
            />

            <MoveDialog
              open={dialog?.kind === "move"}
              folders={view.folders}
              excludedIds={
                dialog?.kind === "move"
                  ? new Set(
                      (() => {
                        const node = findNode(view.tree, dialog.folder.id);
                        return node ? subtreeIds(node) : [dialog.folder.id];
                      })()
                    )
                  : new Set<string>()
              }
              currentParentId={
                dialog?.kind === "move" ? dialog.folder.parent_id ?? null : null
              }
              busy={busy}
              onConfirm={(destinationId) => {
                if (dialog?.kind === "move") {
                  updateFolder.mutate(
                    {
                      folderId: dialog.folder.id,
                      patch: { parent_id: destinationId },
                    },
                    { onSuccess: () => setDialog(null) }
                  );
                }
              }}
              onClose={() => setDialog(null)}
            />
          </Flex>
        );
      }}
    </FolderTree>
  );
}
