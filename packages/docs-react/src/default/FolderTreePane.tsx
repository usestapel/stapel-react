/**
 * `<FolderTreePane/>` — the default skin's folder tree: the `FolderTree`
 * headless bag rendered as an antd `Tree` through core's `matchLoad` (the
 * four-way load discipline: "no folders yet" is only said about a read that
 * succeeded), with a right-click context menu per folder (rename / move /
 * new subfolder / move to trash — exactly the operations stapel-docs
 * exposes; there is no duplicate endpoint, so no duplicate item) and a
 * "New folder" header button. Selection is controlled by the composing
 * surface (`FileManager` keeps the current folder).
 *
 * Replaceable without a fork: `FileManager` resolves this pane through the
 * skin slot registry (`registerDocsSkinComponent("fileManager.treePane", …)`).
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Dropdown, Empty, Flex, Spin, Tree, Typography } from "antd";
import type { TreeDataNode } from "antd";
import { matchLoad, useErrorDisplay, useT } from "@stapel/core";
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
import { ErrorAlert } from "./ErrorAlert.js";
import { MoveDialog, NameDialog } from "./dialogs.js";

export interface FolderTreePaneProps {
  readonly workspaceId: string;
  /** The selected folder, `null` for the workspace root. */
  readonly selectedFolderId: string | null;
  onSelectFolder(folderId: string | null): void;
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
  const t = useT();
  const errorDisplay = useErrorDisplay(DOCS_I18N_KEYS.unknownError);
  const [dialog, setDialog] = useState<DialogState>(null);
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const trashFolder = useTrashFolder();

  const busy =
    createFolder.isPending || updateFolder.isPending || trashFolder.isPending;
  const mutationError =
    createFolder.error ?? updateFolder.error ?? trashFolder.error ?? null;

  function nodeTitle(folder: DocFolder): ReactNode {
    return (
      <Typography.Text data-docs-folder={folder.id}>
        {folder.name}
      </Typography.Text>
    );
  }

  function toTreeData(nodes: readonly FolderTreeNode[]): TreeDataNode[] {
    return nodes.map((node) => ({
      key: node.folder.id,
      title: (
        <Dropdown
          trigger={["contextMenu"]}
          menu={{
            items: [
              { key: "rename", label: t(DOCS_I18N_KEYS.menuRename) },
              { key: "move", label: t(DOCS_I18N_KEYS.menuMove) },
              { key: "newSubfolder", label: t(DOCS_I18N_KEYS.menuNewSubfolder) },
              { type: "divider" },
              {
                key: "trash",
                label: t(DOCS_I18N_KEYS.menuMoveToTrash),
                danger: true,
              },
            ],
            onClick: ({ key }) => {
              if (key === "rename") setDialog({ kind: "rename", folder: node.folder });
              else if (key === "move") setDialog({ kind: "move", folder: node.folder });
              else if (key === "newSubfolder")
                setDialog({ kind: "newFolder", parentId: node.folder.id });
              else if (key === "trash") trashFolder.mutate(node.folder.id);
            },
          }}
        >
          {nodeTitle(node.folder)}
        </Dropdown>
      ),
      children: toTreeData(node.children),
    }));
  }

  function renderTree(view: FolderTreeView): ReactElement {
    if (view.tree.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t(DOCS_I18N_KEYS.managerFoldersEmpty)}
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
      {({ state }) => {
        // The dialogs need the flat list / tree for the destination picker
        // and the cycle exclusion. They only OPEN from a rendered node, i.e.
        // from the ready arm — outside it, empty inputs are honest.
        const view: FolderTreeView =
          state.status === "ready" ? state.data : { tree: [], folders: [] };
        return (
          <Flex vertical gap="small" data-testid="docs-folder-tree-pane">
            <Button
              size="small"
              onClick={() => {
                setDialog({ kind: "newFolder", parentId: null });
              }}
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            >
              {t(DOCS_I18N_KEYS.managerNewFolder)}
            </Button>

            {mutationError !== null && (
              <ErrorAlert
                error={errorDisplay(mutationError)}
                testId="docs-tree-error"
              />
            )}

            {matchLoad(state, {
              loading: () => <Spin />,
              failed: (error) => (
                <ErrorAlert
                  error={errorDisplay(error)}
                  testId="docs-tree-load-error"
                />
              ),
              ready: renderTree,
            })}

            <NameDialog
              open={dialog?.kind === "rename" || dialog?.kind === "newFolder"}
              titleKey={
                dialog?.kind === "newFolder"
                  ? DOCS_I18N_KEYS.dialogNewFolderTitle
                  : DOCS_I18N_KEYS.dialogRenameTitle
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
                dialog?.kind === "move" ? dialog.folder.parent_id : null
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
