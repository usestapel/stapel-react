import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { Recording } from "../api/types.js";
import { useRecording } from "../model/queries.js";

/** Render-prop bag for {@link RecordingDetail}. */
export interface RecordingDetailBag {
  /** The read, as a state a skin cannot flatten — four arms, all required. */
  readonly state: LoadState<Recording>;
  /**
   * Is the PIPELINE the one that moves this recording next? Straight off the
   * payload (`RecordingDTO.is_processing`), not re-derived from the status
   * string, so a status this build has never heard of still lands on the right
   * side of the question.
   */
  readonly isProcessing: boolean;
  /**
   * Seconds until the next read is worth making, or `null` for "stop asking".
   * The hook already polls at exactly this interval; the value is here so a
   * skin can SAY that it is refreshing rather than leaving a stale screen
   * looking final.
   */
  readonly pollAfterSeconds: number | null;
  /** Re-read now (a retry arm, or a manual refresh). */
  refetch(): void;
}

/**
 * Headless recording detail — a renderless read of one recording that POLLS
 * while the pipeline owns it.
 *
 * The polling is the part that used to be missing: this pair's docstrings
 * promised it and no code implemented it, so a recording sat on `transcribing`
 * until the person reloaded the page. The interval is not a constant chosen
 * here — it is `poll_after_seconds` off the payload, and its absence is what
 * stops the loop (see `model/polling.ts`).
 *
 * ```tsx
 * <RecordingDetail recordingId={id}>
 *   {({ state, isProcessing }) => matchLoad(state, { loading, failed, ready })}
 * </RecordingDetail>
 * ```
 */
export function RecordingDetail(props: {
  recordingId: string;
  children: (bag: RecordingDetailBag) => ReactNode;
}): ReactNode {
  const query = useRecording(props.recordingId);
  const recording = query.data;
  return props.children({
    state: loadStateFromQuery(query),
    isProcessing: recording?.is_processing ?? false,
    pollAfterSeconds: recording?.poll_after_seconds ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
