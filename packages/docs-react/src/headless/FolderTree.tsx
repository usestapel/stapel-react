import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { DocFolder } from "../api/types.js";
import { useFolderTree, useFolders } from "../model/queries.js";
import type { FolderTreeNode } from "../model/folderTree.js";

/** Render-prop bag for {@link FolderTree}. */
export interface FolderTreeBag {
  /** Root folders with resolved children (see `buildFolderTree`). */
  readonly tree: readonly FolderTreeNode[];
  /** The same folders, flat, as the backend lists them. */
  readonly folders: readonly DocFolder[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
  refetch(): void;
}

/**
 * Headless folder tree — a renderless read of a workspace's folders,
 * assembled into a tree by `parent_id` (both shapes exposed: recursive
 * `tree` for a tree view, flat `folders` for pickers). Both hooks share ONE
 * cache entry — a single wire read. Bring your own tree UI. Zero visual
 * opinion (frontend-standard §2).
 *
 * ```tsx
 * <FolderTree workspaceId="ws-1">
 *   {({ tree }) => ( ...recurse over node.children... )}
 * </FolderTree>
 * ```
 */
export function FolderTree(props: {
  workspaceId: string;
  children: (bag: FolderTreeBag) => ReactNode;
}): ReactNode {
  const treeQuery = useFolderTree(props.workspaceId);
  const flatQuery = useFolders(props.workspaceId);
  return props.children({
    tree: treeQuery.data ?? [],
    folders: flatQuery.data ?? [],
    isLoading: treeQuery.isLoading,
    isError: treeQuery.isError,
    error: treeQuery.error ?? null,
    refetch: () => {
      void treeQuery.refetch();
    },
  });
}
