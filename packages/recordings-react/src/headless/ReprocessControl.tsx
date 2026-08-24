import type { ReactNode } from "react";
import { actionAvailable, actionBlocked } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { Recording } from "../api/types.js";
import { useReprocess } from "../model/mutations.js";
import { hasErrorCode, isPaymentRequired } from "../flows/errors.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";

/** Render-prop bag for {@link ReprocessControl}. */
export interface ReprocessControlBag {
  /** Whether re-running the pipeline is possible, with the reason when not. */
  readonly gate: ActionAvailability;
  /** Re-run it. Confirm first — this costs a second transcription. */
  run(): void;
  /** The POST is in flight. */
  readonly isSending: boolean;
  /** The recording as it came back — now on `queued`, polling again. */
  readonly recording: Recording | null;
  /** The refusal, if there was one. */
  readonly error: unknown;
  /** The refusal was `402`: a top-up prompt, not a dead end. */
  readonly isPaymentRequired: boolean;
  /**
   * The refusal was the object policy's own `403 recording_action_denied` —
   * "this deployment does not let you do that", which is a different sentence
   * from "you are out of credit" and from "not from this status".
   */
  readonly isDenied: boolean;
  reset(): void;
}

/**
 * Headless reprocess action — re-run the WHOLE pipeline for a finished
 * recording (`completed → queued`): a second transcription, a second
 * diarization, and a second bill.
 *
 * A staff-shaped verb, and the skin must treat it as one: confirm in a dialog
 * that names the cost, and render the refusal arms distinctly. The authority
 * is the object policy's `can_reprocess`, which is only discoverable by
 * trying — a policy answering with a `PolicyDecision` names its OWN status and
 * key (402 for an unpaid balance), so branching on `404` alone tells a paying
 * user their recording does not exist.
 */
export function ReprocessControl(props: {
  recording: Pick<Recording, "id" | "status">;
  children: (bag: ReprocessControlBag) => ReactNode;
}): ReactNode {
  const { recording } = props;
  const mutation = useReprocess();
  const error: unknown = mutation.error;
  return props.children({
    gate: reprocessGate(recording),
    run: () => {
      mutation.mutate(recording.id);
    },
    isSending: mutation.isPending,
    recording: mutation.data ?? null,
    error,
    isPaymentRequired: isPaymentRequired(error),
    isDenied: hasErrorCode(error, "error.403.recording_action_denied"),
    reset: () => {
      mutation.reset();
    },
  });
}

/**
 * The one condition answerable without asking: the backend allows this
 * transition ONLY from `completed`, and from anything else the endpoint is a
 * `409`. Saying so beside the control is better than letting a person spend a
 * click discovering it.
 */
export function reprocessGate(
  recording: Pick<Recording, "status">
): ActionAvailability {
  return recording.status === "completed"
    ? actionAvailable()
    : actionBlocked(RECORDINGS_I18N_KEYS.reprocessBlockedNotCompleted);
}
