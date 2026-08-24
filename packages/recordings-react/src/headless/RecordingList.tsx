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
  /**
   * Re-read now. The hook already polls on its own while any row is
   * mid-pipeline (each recording carries `poll_after_seconds`, and the list
   * asks again at the shortest one until no row does), so this is the manual
   * refresh and the failed arm's retry — not the mechanism that makes a
   * processing recording finish on screen.
   */
  refetch(): void;
}

/**
 * Headless recording list — a renderless read of recordings.
 *
 * Reads what `RECORDING_POLICY` makes visible to the caller (default: their
 * own). `workspaceId` narrows that to one workspace they are a member of — and
 * narrowing is all it does: the workspace listing goes through the same object
 * policy as the per-recording endpoints, so it is "what the policy shows you
 * inside this workspace", NOT "every recording in it". A deployment opts into
 * the latter with `WORKSPACE_LISTING_MEMBERS_SEE_ALL`; a non-member gets
 * `error.403.recording_workspace_forbidden` either way.
 *
 * Wires {@link useRecordings} and hands a {@link RecordingListBag} to
 * `children`; bring your own list/table, skeleton, and empty UI. Zero visual
 * opinion (frontend-standard §2).
 *
 * ```tsx
 * <RecordingList workspaceId="ws-1">
 *   {({ state }) => matchList(state, { loading, failed, empty, ready })}
 * </RecordingList>
 * ```
 */
export function RecordingList(props: {
  /** Narrow the listing to this workspace (requires membership). */
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
