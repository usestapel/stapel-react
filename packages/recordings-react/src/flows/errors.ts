import { toFlowError as coreToFlowError } from "@stapel/core";
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
