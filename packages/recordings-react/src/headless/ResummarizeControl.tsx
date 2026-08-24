import type { ReactNode } from "react";
import { actionAvailable, actionBlocked, firstBlock } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { Job, Recording } from "../api/types.js";
import { useResummarize } from "../model/mutations.js";
import { hasErrorCode, isPaymentRequired } from "../flows/errors.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";

/** Render-prop bag for {@link ResummarizeControl}. */
export interface ResummarizeControlBag {
  /** Whether a re-summary can be asked for, with the reason when it cannot. */
  readonly gate: ActionAvailability;
  /** Ask for one. */
  run(): void;
  /** The POST is in flight (not: the summary is being written). */
  readonly isSending: boolean;
  /**
   * The 202's receipt, once accepted. `202` means the work was TAKEN, not
   * finished — the summary appears through the recording's own read, which
   * polls. Holding the receipt is what lets the UI look as idempotent as the
   * backend is: the same job comes back for a second POST, so a double click
   * must not read as two summaries.
   */
  readonly job: Job | null;
  /** The refusal, if there was one. */
  readonly error: unknown;
  /**
   * The refusal was `402` — the metered host's out-of-credit answer, designed
   * so a UI could offer a top-up instead of a dead end.
   */
  readonly isPaymentRequired: boolean;
  /** Clear the receipt / refusal. */
  reset(): void;
}

/**
 * Headless re-summary action — the user's own cheap verb: the transcript is
 * right (often because a human just corrected it) and only the summary built
 * from an older transcript is stale. No STT, no diarization, no second
 * transcription bill.
 *
 * ```tsx
 * <ResummarizeControl recording={recording}>
 *   {({ gate, run, job }) => <GatedButton gate={gate} onClick={run}>…</GatedButton>}
 * </ResummarizeControl>
 * ```
 */
export function ResummarizeControl(props: {
  recording: Pick<Recording, "id" | "status" | "is_processing" | "segments_count">;
  children: (bag: ResummarizeControlBag) => ReactNode;
}): ReactNode {
  const { recording } = props;
  const mutation = useResummarize();
  const job = mutation.data ?? null;
  const gate = firstBlock(
    resummarizeGate(recording),
    // The 202 is idempotent server-side; the UI holds the same line so the
    // second click is visibly the same action rather than a second charge.
    job !== null && !isFinishedJob(job)
      ? actionBlocked(RECORDINGS_I18N_KEYS.resummarizeBlockedInFlight)
      : actionAvailable()
  );
  const error: unknown = mutation.error;
  return props.children({
    gate,
    run: () => {
      mutation.mutate(recording.id);
    },
    isSending: mutation.isPending,
    job,
    error,
    isPaymentRequired: isPaymentRequired(error),
    reset: () => {
      mutation.reset();
    },
  });
}

/**
 * Is a re-summary meaningful for this recording? The two refusals the backend
 * names — `409 recording_no_transcript` ("nothing to summarize yet") and a
 * recording still mid-pipeline — are answered here BEFORE the round-trip, so
 * the control carries its reason instead of discovering it from an error.
 *
 * The authority that cannot be answered locally is the object policy's
 * `can_resummarize`, which is only discoverable by trying. That refusal is a
 * first-class arm on the bag (`error`, `isPaymentRequired`), not a surprise.
 */
export function resummarizeGate(
  recording: Pick<Recording, "is_processing" | "segments_count">
): ActionAvailability {
  if (recording.is_processing) {
    return actionBlocked(RECORDINGS_I18N_KEYS.resummarizeBlockedProcessing);
  }
  if (recording.segments_count === 0) {
    return actionBlocked(RECORDINGS_I18N_KEYS.resummarizeBlockedNoTranscript);
  }
  return actionAvailable();
}

/** A job the backend reports as settled — nothing further will land on it. */
function isFinishedJob(job: Job): boolean {
  return job.status === "completed" || job.status === "failed";
}

/** Did this refusal say "there is no transcript to summarize yet"? */
export function isNoTranscript(error: unknown): boolean {
  return hasErrorCode(error, "error.409.recording_no_transcript");
}

/** Did this refusal say the deployment has summaries switched off? */
export function isSummarizeUnavailable(error: unknown): boolean {
  return hasErrorCode(error, "error.503.recording_summarize_unavailable");
}
