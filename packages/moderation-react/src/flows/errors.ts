import { toFlowError as coreToFlowError } from "@stapel/core";
import type { FlowError } from "@stapel/core";

export type { FlowError } from "@stapel/core";
export { isErrorCode } from "@stapel/core";

/**
 * Has this value already been folded?
 *
 * A flow machine's `refused` state carries a `FlowError`, not the thrown value
 * — so anything reading a refusal OFF A MACHINE hands a `FlowError` back into
 * the folding function. Core's `toFlowError` only recognises `StapelApiError`
 * and collapses everything else to the fallback code, so a second pass would
 * erase the very `code` the refusal predicates exist to read: every
 * `isAlreadyReported`/`isNotAppellant`/`isSameActor` call downstream of a
 * machine would answer `false` and the screen would fall back to the backend's
 * own sentence instead of the one written for that situation.
 *
 * `Error` instances are excluded on purpose: `StapelApiError` carries
 * `code`/`params`/`status` too, and it must go down the real fold so its
 * `language` and `message` are read the way core reads them.
 */
function isFolded(value: unknown): value is FlowError {
  if (typeof value !== "object" || value === null) return false;
  if (value instanceof Error) return false;
  return (
    "code" in value && "params" in value && "status" in value && "message" in value
  );
}

/**
 * Fold any thrown value into a {@link FlowError} using this pair's own
 * module-scoped fallback key (`moderation.error.unknown`, an en string in
 * {@link moderationI18nBundleEn}) so a non-`StapelApiError` fault still renders
 * real copy rather than a raw key. The primitive lives in `@stapel/core`
 * (frontend-core-architecture §4b); this wrapper pins the fallback and adds the
 * idempotence core's version lacks (see {@link isFolded}).
 */
export function toFlowError(error: unknown): FlowError {
  if (isFolded(error)) return error;
  return coreToFlowError(error, "moderation.error.unknown");
}
