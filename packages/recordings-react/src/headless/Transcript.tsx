import type { ReactNode } from "react";
import { loadFailed, loadLoading, loadReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { TranscriptParams, TranscriptSegment } from "../api/types.js";
import { useTranscript } from "../model/queries.js";

/** Render-prop bag for {@link Transcript}. */
export interface TranscriptBag {
  /**
   * Every segment fetched so far, flattened across pages, in reading order.
   *
   * A load state, not an array: an empty transcript and a transcript that
   * FAILED to load look identical once flattened, and "this recording has no
   * transcript" is a sentence nobody double-checks. The empty arm here is a
   * real, expected stage — the pipeline has not written any segments yet.
   */
  readonly state: LoadState<readonly TranscriptSegment[]>;
  /** More pages exist (the wire's `has_next`, not a guess from page length). */
  readonly hasMore: boolean;
  /** Fetch the next page (forward, in reading order). */
  loadMore(): void;
  /** A page fetch is in flight. */
  readonly isLoadingMore: boolean;
  /** Total segments the backend reports for the pages read so far. */
  readonly count: number;
  /** Re-read from the first page. */
  refetch(): void;
}

/**
 * Headless transcript — speaker-attributed segments for a recording the caller
 * OWNS (`GET /recordings/{id}/transcript`, backend 0.20.0).
 *
 * Before 0.20.0 this component could not exist: segments left the module only
 * through `SharedRecordingDTO.segments`, so an owner had to publish their
 * recording to the internet to read their own transcript. The wire shape is
 * the same one the share path projects (`TranscriptSegmentDTO`), which is why
 * a transcript renderer is written once and serves both doors.
 *
 * ```tsx
 * <Transcript recordingId={id}>
 *   {({ state, hasMore, loadMore }) => matchList(state, { … })}
 * </Transcript>
 * ```
 */
export function Transcript(props: {
  recordingId: string;
  /** Page size / direction overrides; the defaults read forward from the top. */
  params?: TranscriptParams;
  children: (bag: TranscriptBag) => ReactNode;
}): ReactNode {
  const query = useTranscript(props.recordingId, props.params);
  const pages = query.data?.pages;
  let state: LoadState<readonly TranscriptSegment[]>;
  if (query.isError) {
    state = loadFailed(query.error);
  } else if (pages === undefined) {
    state = loadLoading();
  } else {
    state = loadReady(pages.flatMap((page) => page.items));
  }
  const lastPage = pages?.[pages.length - 1];
  return props.children({
    state,
    hasMore: query.hasNextPage,
    loadMore: () => {
      void query.fetchNextPage();
    },
    isLoadingMore: query.isFetchingNextPage,
    count: lastPage?.count ?? 0,
    refetch: () => {
      void query.refetch();
    },
  });
}

/**
 * Which segment covers `time` (seconds into the recording)? `-1` when none
 * does — before the first segment, in a gap between two, or after the last.
 *
 * A binary search rather than a scan: a meeting transcript is thousands of
 * segments and this runs on every `timeupdate` the media element fires (about
 * four times a second), so a linear pass would be the most expensive thing on
 * the page. Segments arrive ordered by `sequence_num`, which is also start
 * order, so the array is already sorted.
 */
export function segmentIndexAt(
  segments: readonly TranscriptSegment[],
  time: number
): number {
  let low = 0;
  let high = segments.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const segment = segments[mid];
    if (segment === undefined) break;
    if (time < segment.start_time) {
      high = mid - 1;
    } else {
      found = mid;
      low = mid + 1;
    }
  }
  if (found === -1) return -1;
  const candidate = segments[found];
  if (candidate === undefined) return -1;
  return time <= candidate.end_time ? found : -1;
}

/**
 * The label for a segment's speaker: the wire's own value, or the positional
 * fallback a caller supplies for a segment the diarizer did not attribute.
 *
 * `speaker` is nullable on the wire and a null one is common — a single-voice
 * dictaphone recording has no speakers to tell apart. Rendering an empty label
 * there leaves a column of blanks; rendering "null" is worse.
 */
export function speakerLabel(
  segment: Pick<TranscriptSegment, "speaker">,
  fallback: (index: number) => string,
  index: number
): string {
  const speaker = segment.speaker;
  return speaker !== null && speaker !== "" ? speaker : fallback(index);
}
