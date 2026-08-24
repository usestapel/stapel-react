import { toFlowError as coreToFlowError, isErrorCode } from "@stapel/core";
import type { FlowError } from "@stapel/core";

export type { FlowError } from "@stapel/core";
export { isErrorCode } from "@stapel/core";

/**
 * Fold any thrown value into a {@link FlowError} using this pair's own
 * module-scoped fallback key (`recordings.error.unknown`, an en string in
 * {@link recordingsI18nBundleEn}) so a non-`StapelApiError` fault still renders
 * real copy rather than a raw key. The primitive lives in `@stapel/core`
 * (frontend-core-architecture §4b); this wrapper only pins the fallback.
 */
export function toFlowError(error: unknown): FlowError {
  return coreToFlowError(error, "recordings.error.unknown");
}

/**
 * Did this thrown value carry that backend code? The `unknown`-shaped twin of
 * core's `isErrorCode` (which takes an already-folded `FlowError`), so a call
 * site branching on a mutation's `error` does not have to fold it first.
 *
 * Branching on the CODE, not on the status, is the point: stapel-recordings'
 * object policy answers a refusal with its own status AND its own key
 * (`error.402.recording_payment_required` for an unpaid balance,
 * `error.409.recording_no_transcript` for nothing to summarize), and a UI that
 * reads only the number tells a metered user their recording does not exist.
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  return isErrorCode(toFlowError(error), code);
}

/**
 * Is this the metered host's out-of-credit refusal — the one
 * `views.py` designed specifically so a UI could turn it into a top-up prompt?
 *
 * Matches the module's own key first and any other 402 second: a deployment
 * whose policy answers `PolicyDecision(status=402)` with a different key is
 * saying the same thing, and rendering "something went wrong" at a person who
 * simply needs to top up is the failure this predicate exists to prevent.
 */
export function isPaymentRequired(error: unknown): boolean {
  const flow = toFlowError(error);
  return (
    flow.code === "error.402.recording_payment_required" || flow.status === 402
  );
}
