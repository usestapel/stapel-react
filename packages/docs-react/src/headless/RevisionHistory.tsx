import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { DocRevision } from "../api/types.js";
import { useRevisions } from "../model/queries.js";
import { useCreateRevision, useRestoreRevision } from "../model/mutations.js";

/** Render-prop bag for {@link RevisionHistory}. */
export interface RevisionHistoryBag {
  /** The document's revisions, as the backend orders them. */
  readonly revisions: readonly DocRevision[];
  /** Pin the current content as a named revision. */
  createRevision(name: string): void;
  readonly isCreating: boolean;
  /** Restore the content to a revision (lands as a NEW head — history keeps
   * everything). */
  restore(revisionId: string): void;
  readonly isRestoring: boolean;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
  refetch(): void;
}

/**
 * Headless revision history — a renderless read of a document's revisions
 * plus the two writes a history surface needs (pin-as-named, restore).
 * Bring your own timeline UI. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <RevisionHistory documentId={doc.id}>
 *   {({ revisions, restore }) => ( ... )}
 * </RevisionHistory>
 * ```
 */
export function RevisionHistory(props: {
  documentId: string;
  children: (bag: RevisionHistoryBag) => ReactNode;
}): ReactNode {
  const query = useRevisions(props.documentId);
  const createMutation = useCreateRevision(props.documentId);
  const restoreMutation = useRestoreRevision(props.documentId);
  return props.children({
    revisions: query.data ?? [],
    createRevision: (name) => {
      createMutation.mutate({ name });
    },
    isCreating: createMutation.isPending,
    restore: (revisionId) => {
      restoreMutation.mutate({ revisionId });
    },
    isRestoring: restoreMutation.isPending,
    isLoading: query.isLoading,
    isError: query.isError || createMutation.isError || restoreMutation.isError,
    error:
      query.error ?? createMutation.error ?? restoreMutation.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
