import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { DocRevision } from "../api/types.js";
import { useRevisions } from "../model/queries.js";
import { useCreateRevision, useRestoreRevision } from "../model/mutations.js";

/** Render-prop bag for {@link RevisionHistory}. */
export interface RevisionHistoryBag {
  /** The revision list as a state a skin cannot flatten (core's
   * `LoadState`; render with `matchList` — "no revisions yet" only for a
   * load that succeeded). */
  readonly state: LoadState<readonly DocRevision[]>;
  /** Pin the current content as a named revision. */
  createRevision(name: string): void;
  readonly isCreating: boolean;
  /** The PIN write's failure — a different question from {@link state}. */
  readonly createError: StapelApiError | null;
  /** Restore the content to a revision (lands as a NEW head — history keeps
   * everything). */
  restore(revisionId: string): void;
  readonly isRestoring: boolean;
  /** The RESTORE write's failure. */
  readonly restoreError: StapelApiError | null;
  refetch(): void;
}

/**
 * Headless revision history — a renderless read of a document's revisions
 * plus the two writes a history surface needs (pin-as-named, restore).
 * Bring your own timeline UI. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <RevisionHistory documentId={doc.id}>
 *   {({ state, restore }) => matchList(state, { loading, failed, empty, ready })}
 * </RevisionHistory>
 * ```
 *
 * `enabled` (default true) holds the READ back while the surface drawing it
 * is mounted but not shown — a closed dialog reads nothing. The writes are
 * unaffected: a mutation only fires when something calls it.
 */
export function RevisionHistory(props: {
  documentId: string;
  enabled?: boolean;
  children: (bag: RevisionHistoryBag) => ReactNode;
}): ReactNode {
  const query = useRevisions(props.documentId, {
    enabled: props.enabled ?? true,
  });
  const createMutation = useCreateRevision(props.documentId);
  const restoreMutation = useRestoreRevision(props.documentId);
  return props.children({
    state: loadStateFromQuery(query),
    createRevision: (name) => {
      createMutation.mutate({ name });
    },
    isCreating: createMutation.isPending,
    createError: createMutation.error ?? null,
    restore: (revisionId) => {
      restoreMutation.mutate({ revisionId });
    },
    isRestoring: restoreMutation.isPending,
    restoreError: restoreMutation.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
