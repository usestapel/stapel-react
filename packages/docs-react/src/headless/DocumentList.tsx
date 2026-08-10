import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { DocDocument } from "../api/types.js";
import { useDocuments } from "../model/queries.js";

/** Render-prop bag for {@link DocumentList}. */
export interface DocumentListBag {
  /**
   * The read as a state a skin cannot flatten: `loading` / `ready` with the
   * rows / `failed` with the error. Render with core's `matchList` — its
   * four required arms are what keeps "no documents yet" a sentence that can
   * only be said about a load that actually succeeded (the 2026-08-09
   * flattened-list incident; `stapel/no-flattened-load-state`).
   */
  readonly state: LoadState<readonly DocDocument[]>;
  /** Re-read the list. */
  refetch(): void;
}

/**
 * Headless document list — a renderless read of a workspace's documents,
 * optionally scoped to a folder, a type, or a search query. Wires
 * {@link useDocuments} and hands a {@link DocumentListBag} to `children`;
 * bring your own list/table, skeleton, empty, and error UI. Zero visual
 * opinion (frontend-standard §2).
 *
 * ```tsx
 * <DocumentList workspaceId="ws-1" folderId={folder?.id}>
 *   {({ state }) => matchList(state, { loading, failed, empty, ready })}
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
    state: loadStateFromQuery(query),
    refetch: () => {
      void query.refetch();
    },
  });
}
