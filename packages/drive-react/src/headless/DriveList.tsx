import type { ReactNode } from "react";
import { bothLoaded, loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { useDocuments } from "@stapel/docs-react";
import { useFolderChildren } from "../model/queries.js";
import { useToggleStar } from "../model/mutations.js";
import { driveRows } from "./rows.js";
import type { DriveRow } from "./rows.js";

/** Render-prop bag for {@link DriveList} and {@link DriveGrid}. */
export interface DriveListBag {
  /**
   * The current folder's contents — folders first, then documents — as a
   * state a skin cannot flatten (core's `LoadState`;
   * `stapel/no-flattened-load-state`). Render it with `matchList`: "this
   * folder is empty" is a sentence that must only be sayable about a read
   * that actually succeeded.
   *
   * The two reads (`GET /folders?parent_id=` and `GET /documents?folder_id=`)
   * are joined with `bothLoaded`, which fails on the FIRST failure rather
   * than letting a slow sibling mask a real error.
   */
  readonly state: LoadState<readonly DriveRow[]>;
  /** The folder being listed; `null` at the workspace root. */
  readonly folderId: string | null;
  /** Star or unstar a row, optimistically (see `useToggleStar`). */
  toggleStar(row: DriveRow, starred: boolean): void;
  readonly isTogglingStar: boolean;
  refetch(): void;
}

/**
 * Headless drive listing — the rows of ONE folder.
 *
 * One rung per request (spec §4, categories-cascade canon): the folder read
 * asks for `parent_id` children, not the tree, and the document read is
 * already folder-scoped. Opening a folder mounts this again with a new
 * `folderId`, which is a new cache entry, which is one request — never a
 * whole-tree sync, and never a prefetch of folders nobody opened.
 *
 * ```tsx
 * <DriveList workspaceId="ws-1" folderId={folderId}>
 *   {({ state }) => matchList(state, { loading, failed, empty, ready })}
 * </DriveList>
 * ```
 */
export function DriveList(props: {
  workspaceId: string;
  /** The folder to list; `null` = the workspace root. */
  folderId: string | null;
  children: (bag: DriveListBag) => ReactNode;
}): ReactNode {
  return props.children(useDriveListBag(props.workspaceId, props.folderId));
}

/**
 * The grid twin of {@link DriveList} — the SAME bag.
 *
 * Two components and one bag on purpose: list and grid are one dataset drawn
 * two ways, and a second hook would be a second chance for them to disagree
 * about ordering, starring or which folder is open. The toggle between them
 * is a skin concern; both are headless exports so a host can mount either.
 */
export function DriveGrid(props: {
  workspaceId: string;
  folderId: string | null;
  children: (bag: DriveListBag) => ReactNode;
}): ReactNode {
  return props.children(useDriveListBag(props.workspaceId, props.folderId));
}

/** @internal The shared body — a hook, so both components keep hook order. */
function useDriveListBag(
  workspaceId: string,
  folderId: string | null
): DriveListBag {
  const folders = useFolderChildren(workspaceId, folderId);
  const documents = useDocuments({
    workspaceId,
    ...(folderId !== null ? { folderId } : {}),
  });
  const toggle = useToggleStar();

  return {
    state: mapLoad(
      bothLoaded(loadStateFromQuery(folders), loadStateFromQuery(documents)),
      ([folderRows, documentRows]) =>
        driveRows(
          folderRows,
          // BACKEND GAP, filtered client-side at the ROOT only:
          // `GET /documents?folder_id=` is a `UUIDField`, so the wire has no
          // spelling for "the documents with no folder". Absent means the
          // whole workspace, which at the root would list every file in every
          // folder. Inside a folder the server scopes it and this filter is a
          // no-op. The cost is one over-broad read at the root; the
          // alternative — showing a workspace's entire corpus as the contents
          // of "/" — is wrong, not merely expensive. Recorded as a backend
          // request (a nullable-friendly `folder_id=root` / `parent_id`-style
          // spelling, exactly what `GET /folders` already has).
          folderId === null
            ? documentRows.filter((row) => (row.folder_id ?? null) === null)
            : documentRows
        )
    ),
    folderId,
    toggleStar: (row, starred) => {
      toggle.mutate({ target: { kind: row.kind, id: row.id }, starred });
    },
    isTogglingStar: toggle.isPending,
    refetch: () => {
      void folders.refetch();
      void documents.refetch();
    },
  };
}
