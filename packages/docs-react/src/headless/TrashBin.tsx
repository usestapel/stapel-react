import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { DocDocument } from "../api/types.js";
import { useTrash } from "../model/queries.js";
import { useTrashActions } from "../model/mutations.js";

/** Render-prop bag for {@link TrashBin}. */
export interface TrashBag {
  /** The workspace's trashed documents. */
  readonly items: readonly DocDocument[];
  /** Take a document out of the trash. */
  restoreDocument(documentId: string): void;
  /** Take a folder out of the trash. */
  restoreFolder(folderId: string): void;
  readonly isRestoring: boolean;
  /** Permanently delete — the given ids, or the whole trash when omitted. */
  emptyTrash(ids?: readonly string[]): void;
  readonly isEmptying: boolean;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
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
 *   {({ items, restoreDocument, emptyTrash }) => ( ... )}
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
    items: query.data ?? [],
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
        ...(ids !== undefined ? { ids } : {}),
      });
    },
    isEmptying: actions.emptyTrash.isPending,
    isLoading: query.isLoading,
    isError:
      query.isError ||
      actions.restoreDocument.isError ||
      actions.restoreFolder.isError ||
      actions.emptyTrash.isError,
    error:
      query.error ??
      actions.restoreDocument.error ??
      actions.restoreFolder.error ??
      actions.emptyTrash.error ??
      null,
    refetch: () => {
      void query.refetch();
    },
  });
}
