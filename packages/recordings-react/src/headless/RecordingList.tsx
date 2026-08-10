import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { Recording } from "../api/types.js";
import { useRecordings } from "../model/queries.js";

/** Render-prop bag for {@link RecordingList}. */
export interface RecordingListBag {
  /**
   * The read, as a state a skin cannot flatten — render it through core's
   * `matchList`, whose four arms are all required.
   *
   * A recordings list is the surface where the flattened shape is most
   * expensive: "you have not uploaded anything yet" is the normal first-run
   * screen, so a failed read wearing that copy is indistinguishable from the
   * expected one and nobody looks twice. That is how the 2026-08-09 workspace
   * outage stayed invisible for hours on the sibling pair.
   */
  readonly state: LoadState<readonly Recording[]>;
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
 *   {({ state }) => matchList(state, { loading, failed, empty, ready })}
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
    state: loadStateFromQuery(query),
    refetch: () => {
      void query.refetch();
    },
  });
}
