/**
 * The error vocabulary, mirrored — and the one step that turns a server
 * verdict into refusals sitting on the controls that caused them.
 *
 * Both halves come straight from `stapel_attributes.errors`: the machine code
 * (`ValidationErrorCode`) and the localizable key it maps to
 * (`ERROR_CODE_TO_KEY`). Nothing here invents copy: a "too long" caught by
 * the client mirror and a "too long" caught by the server render the SAME
 * sentence from the SAME key, because they ARE the same key. The alternative
 * — pair-invented wording for the local half — gives a person two sentences
 * for one problem and makes the local one a lie the moment the backend's rule
 * moves.
 *
 * The keys themselves are owned by stapel-attributes and registered with
 * stapel-core (`register_service_errors(ATTRIBUTES_ERRORS)`), so a host that
 * already has a pair's generated error bundle has their copy; the fallback
 * English lives in this package's own i18n bundle for a host that does not.
 */
import type { FlowError } from "@stapel/core";
import type {
  FeatureValidationResult,
  ValidationBatchResult,
  ValidationErrorCode,
} from "./types.js";

/**
 * Every `ValidationErrorCode` the engine defines, sorted.
 *
 * Pinned byte-for-byte against `stapel-attributes/tests/golden/
 * error_codes.json` — the corpus the engine generates from its own enum and
 * asserts from both Python and TypeScript. A code added upstream and not here
 * turns `test/contract.test.ts` red.
 */
export const VALIDATION_ERROR_CODES: readonly ValidationErrorCode[] = [
  "above_maximum",
  "below_minimum",
  "description_too_long",
  "description_too_short",
  "duplicate_slug",
  "empty_options",
  "invalid_config",
  "invalid_format",
  "invalid_type",
  "mandatory_missing",
  "min_greater_than_max",
  "not_allowed",
  "not_in_options",
  "unknown_feature",
  "unknown_feature_type",
];

/**
 * `ValidationErrorCode` → localizable key, mirroring
 * `stapel_attributes.errors.ERROR_CODE_TO_KEY` exactly — including the three
 * codes that deliberately collapse onto one key (`duplicate_slug` reports as
 * an unknown type; `min_greater_than_max` and `empty_options` are both
 * invalid config). Collapsing them differently here would make the client
 * claim a distinction the server does not draw.
 */
export const ERROR_CODE_TO_KEY: Readonly<Record<ValidationErrorCode, string>> = {
  below_minimum: "error.400.feature_below_minimum",
  above_maximum: "error.400.feature_above_maximum",
  not_in_options: "error.400.feature_not_in_options",
  invalid_type: "error.400.feature_invalid_type",
  invalid_format: "error.400.feature_invalid_format",
  mandatory_missing: "error.400.feature_mandatory_missing",
  duplicate_slug: "error.400.feature_unknown_type",
  unknown_feature_type: "error.400.feature_unknown_type",
  not_allowed: "error.400.feature_not_allowed",
  unknown_feature: "error.400.feature_unknown",
  invalid_config: "error.400.feature_invalid_config",
  min_greater_than_max: "error.400.feature_invalid_config",
  empty_options: "error.400.feature_invalid_config",
  description_too_short: "error.400.description_too_short",
  description_too_long: "error.400.description_too_long",
};

/** The key a result should render from: what the server said, else the one
 * its code maps to. The server sends `localizable_error` already — this only
 * covers the mirror's rows and a server that ever omits it. */
export function resultErrorKey(
  result: FeatureValidationResult
): string | undefined {
  if (typeof result.localizable_error === "string" && result.localizable_error.length > 0) {
    return result.localizable_error;
  }
  return result.error ? ERROR_CODE_TO_KEY[result.error] : undefined;
}

/**
 * A batch verdict, split into per-control refusals keyed by feature slug.
 *
 * `params.field` is added on the way out. The engine's own params are
 * `{feature, slug}` (`validation.py`) and the fleet's `useFieldError`
 * convention routes on `field` — so without this a perfectly well-formed
 * server refusal lands in a page-level banner instead of under the control
 * whose value caused it, which is the difference between "something is wrong"
 * and "this box is wrong".
 *
 * `ref_value` rides along in params too: `error.400.feature_below_minimum`
 * interpolates the limit, and the limit is what `ref_value` carries.
 */
export function featureErrorsBySlug(
  batch: ValidationBatchResult
): Readonly<Record<string, FlowError>> {
  const out: Record<string, FlowError> = {};
  for (const result of batch.results) {
    if (result.status !== "validation_failed") continue;
    const code = resultErrorKey(result);
    if (code === undefined) continue;
    out[result.slug] = {
      code,
      params: {
        ...(result.params ?? {}),
        field: result.slug,
        slug: result.slug,
        ...(result.ref_value === undefined || result.ref_value === null
          ? {}
          : { ref_value: result.ref_value }),
      },
      status: 400,
      message: result.message ?? undefined,
      language: undefined,
    };
  }
  return out;
}
