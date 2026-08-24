import type { DocFolder } from "../api/types.js";

/** A folder with its resolved children — what {@link buildFolderTree} emits. */
export interface FolderTreeNode {
  readonly folder: DocFolder;
  readonly children: readonly FolderTreeNode[];
}

/**
 * Assemble the flat `GET /folders` list into a tree by `parent_id`. Pure and
 * order-preserving (children keep the backend's list order). A folder whose
 * parent is not in the list (e.g. the parent is trashed) is treated as a
 * root — an orphan stays reachable rather than silently dropped.
 */
export function buildFolderTree(
  folders: readonly DocFolder[]
): FolderTreeNode[] {
  const byId = new Map<string, DocFolder>();
  for (const folder of folders) byId.set(folder.id, folder);

  const childrenOf = new Map<string | null, DocFolder[]>();
  for (const folder of folders) {
    // `parent_id` is optional on the wire as well as nullable; both spellings
    // mean "at the workspace root".
    const parentId = folder.parent_id ?? null;
    const parentKey =
      parentId !== null && byId.has(parentId) ? parentId : null;
    const siblings = childrenOf.get(parentKey);
    if (siblings) siblings.push(folder);
    else childrenOf.set(parentKey, [folder]);
  }

  function nodeOf(folder: DocFolder): FolderTreeNode {
    return {
      folder,
      children: (childrenOf.get(folder.id) ?? []).map(nodeOf),
    };
  }

  return (childrenOf.get(null) ?? []).map(nodeOf);
}

/**
 * The breadcrumb trail for a folder: root → … → the folder itself, walked up
 * `parent_id` over the flat list. Empty for `folderId: null` (the workspace
 * root) or an id absent from the list. Cycles (bad data) terminate rather
 * than loop.
 */
export function folderTrail(
  folders: readonly DocFolder[],
  folderId: string | null
): DocFolder[] {
  if (folderId === null) return [];
  const byId = new Map<string, DocFolder>();
  for (const folder of folders) byId.set(folder.id, folder);

  const trail: DocFolder[] = [];
  const seen = new Set<string>();
  let cursor: string | null = folderId;
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor);
    const folder = byId.get(cursor);
    if (!folder) break;
    trail.unshift(folder);
    cursor = folder.parent_id ?? null;
  }
  return trail;
}
