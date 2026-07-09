import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { Recording } from "../api/types.js";
import { useRecordings } from "../model/queries.js";

/** Render-prop bag for {@link RecordingList}. */
export interface RecordingListBag {
  /** The current user's recordings. */
  readonly recordings: readonly Recording[];
  /** The list read is loading (no data yet). */
  readonly isLoading: boolean;
  /** The query failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Re-read the list (e.g. to poll a processing recording to completion). */
  refetch(): void;
}

/**
 * Headless recording list — a renderless read of recordings. Reads the caller's
 * own recordings by default, or a whole workspace's when `workspaceId` is set
 * (requires membership). Wires {@link useRecordings} and hands a
 * {@link RecordingListBag} to `children`; bring your own list/table, skeleton,
 * and empty UI. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <RecordingList workspaceId="ws-1">
 *   {({ recordings }) => ( ... )}
 * </RecordingList>
 * ```
 */
export function RecordingList(props: {
  /** List a whole workspace's recordings (requires membership) instead of own. */
  workspaceId?: string;
  children: (bag: RecordingListBag) => ReactNode;
}): ReactNode {
  const query = useRecordings(
    props.workspaceId !== undefined ? { workspaceId: props.workspaceId } : undefined
  );
  return props.children({
    recordings: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
