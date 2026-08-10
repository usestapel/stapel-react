import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { DocDocument } from "../api/types.js";
import { useDocuments } from "../model/queries.js";

/** Render-prop bag for {@link DocumentList}. */
export interface DocumentListBag {
  /** The matching documents, as the backend orders them. */
  readonly documents: readonly DocDocument[];
  /** The list read is loading (no data yet). */
  readonly isLoading: boolean;
  /** The query failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Re-read the list. */
  refetch(): void;
}

/**
 * Headless document list — a renderless read of a workspace's documents,
 * optionally scoped to a folder, a type, or a search query. Wires
 * {@link useDocuments} and hands a {@link DocumentListBag} to `children`;
 * bring your own list/table, skeleton, and empty UI. Zero visual opinion
 * (frontend-standard §2).
 *
 * ```tsx
 * <DocumentList workspaceId="ws-1" folderId={folder?.id}>
 *   {({ documents }) => ( ... )}
 * </DocumentList>
 * ```
 */
export function DocumentList(props: {
  workspaceId: string;
  /** Scope to one folder (omit for the whole workspace). */
  folderId?: string;
  /** Scope to one document type slug. */
  type?: string;
  /** Full-text query. */
  q?: string;
  children: (bag: DocumentListBag) => ReactNode;
}): ReactNode {
  const query = useDocuments({
    workspaceId: props.workspaceId,
    ...(props.folderId !== undefined ? { folderId: props.folderId } : {}),
    ...(props.type !== undefined ? { type: props.type } : {}),
    ...(props.q !== undefined ? { q: props.q } : {}),
  });
  return props.children({
    documents: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
