import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { TrashListing } from "../api/types.js";
import { useTrash } from "../model/queries.js";
import { useTrashActions } from "../model/mutations.js";

/** Render-prop bag for {@link TrashBin}. */
export interface TrashBag {
  /**
   * The trash read as a state a skin cannot flatten (core's `LoadState`;
   * `stapel/no-flattened-load-state`) — the ready arm carries the backend's
   * REAL `{folders, documents}` shape (the 0.1.0 documents-only `items` was
   * a drift against `TrashView`; fixed 0.2.0). "Trash is empty" is only
   * ever said about a load that succeeded.
   */
  readonly state: LoadState<TrashListing>;
  /** Take a document out of the trash. */
  restoreDocument(documentId: string): void;
  /** Take a folder out of the trash. */
  restoreFolder(folderId: string): void;
  readonly isRestoring: boolean;
  /** Permanently delete — the given ids (folders and/or documents), or the
   * whole trash when omitted. */
  emptyTrash(ids?: readonly string[]): void;
  readonly isEmptying: boolean;
  /** The WRITES' failure (restore / empty) — a different question from
   * {@link state}, which is about the read. */
  readonly writeError: StapelApiError | null;
  refetch(): void;
}

/**
 * Headless trash — a renderless read of the workspace's trash plus its
 * writes (restore document/folder, empty). Bring your own list + confirm
 * UI (permanently-delete confirmation is a host concern). Zero visual
 * opinion (frontend-standard §2).
 *
 * ```tsx
 * <TrashBin workspaceId="ws-1">
 *   {({ state, restoreDocument, emptyTrash }) =>
 *     matchLoad(state, { loading, failed, ready: ({ documents, folders }) => … })}
 * </TrashBin>
 * ```
 */
export function TrashBin(props: {
  workspaceId: string;
  children: (bag: TrashBag) => ReactNode;
}): ReactNode {
  const query = useTrash(props.workspaceId);
  const actions = useTrashActions();
  return props.children({
    state: loadStateFromQuery(query),
    restoreDocument: (documentId) => {
      actions.restoreDocument.mutate(documentId);
    },
    restoreFolder: (folderId) => {
      actions.restoreFolder.mutate(folderId);
    },
    isRestoring:
      actions.restoreDocument.isPending || actions.restoreFolder.isPending,
    emptyTrash: (ids) => {
      actions.emptyTrash.mutate({
        workspace_id: props.workspaceId,
        ...(ids !== undefined ? { ids: [...ids] } : {}),
      });
    },
    isEmptying: actions.emptyTrash.isPending,
    writeError:
      actions.restoreDocument.error ??
      actions.restoreFolder.error ??
      actions.emptyTrash.error ??
      null,
    refetch: () => {
      void query.refetch();
    },
  });
}
