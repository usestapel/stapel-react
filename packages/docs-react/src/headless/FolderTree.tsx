import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { DocFolder } from "../api/types.js";
import { useFolders } from "../model/queries.js";
import { buildFolderTree } from "../model/folderTree.js";
import type { FolderTreeNode } from "../model/folderTree.js";

/** What a ready {@link FolderTreeBag.state} carries: the same wire read in
 * both shapes (recursive `tree` for a tree view, flat `folders` for
 * pickers). */
export interface FolderTreeView {
  readonly tree: readonly FolderTreeNode[];
  readonly folders: readonly DocFolder[];
}

/** Render-prop bag for {@link FolderTree}. */
export interface FolderTreeBag {
  /**
   * The read as a state a skin cannot flatten (`loading` / `ready` /
   * `failed` — core's `LoadState`; `stapel/no-flattened-load-state`). Render
   * with `matchLoad`, so "no folders yet" is only ever said about a load
   * that succeeded.
   */
  readonly state: LoadState<FolderTreeView>;
  refetch(): void;
}

/**
 * Headless folder tree — a renderless read of a workspace's folders,
 * assembled into a tree by `parent_id` (both shapes exposed on the ready
 * arm). ONE wire read (the flat list), the tree derived from it. Bring your
 * own tree UI. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <FolderTree workspaceId="ws-1">
 *   {({ state }) => matchLoad(state, { loading, failed, ready: ({ tree }) => … })}
 * </FolderTree>
 * ```
 */
export function FolderTree(props: {
  workspaceId: string;
  children: (bag: FolderTreeBag) => ReactNode;
}): ReactNode {
  const query = useFolders(props.workspaceId);
  return props.children({
    state: mapLoad(loadStateFromQuery(query), (folders) => ({
      tree: buildFolderTree(folders),
      folders,
    })),
    refetch: () => {
      void query.refetch();
    },
  });
}
