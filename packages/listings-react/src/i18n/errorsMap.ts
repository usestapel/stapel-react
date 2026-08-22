/**
 * The pair's error map (frontend-standard §4 checklist #7, frontend-core
 * §2.5): the generated `code → { status, params, remediation, en }` catalog
 * plus a tiny `explain()` lookup. Backs the manifest `errors` block and gives
 * hosts a mechanical UX branch beside `t(code, params)`. The map itself is
 * generated from the backend registry (`pnpm gen:errors`); this file only
 * adds the lookup helper, names the three refusals a storefront actually
 * meets, and re-exports the public surface.
 */
import { LISTINGS_ERRORS } from "./generated/errors.gen.js";
import type { Remediation } from "./generated/errors.gen.js";

export {
  LISTINGS_ERRORS,
  LISTINGS_ERROR_CODES,
  listingsErrorBundleEn,
} from "./generated/errors.gen.js";
export type {
  ListingsErrorCode,
  ListingsErrorSpec,
  Remediation,
} from "./generated/errors.gen.js";

/**
 * The lifecycle refusal, and the one code in this registry that carries the
 * information needed to explain itself: `params.from_status` is the state the
 * server refused to move OUT of (`views._transition`). A skin renders
 * "a listing that is sold cannot be archived that way", not "conflict".
 */
export const LISTING_INVALID_TRANSITION = "error.409.invalid_listing_transition";

/** Deleting something that is on sale. The remedy is in the sentence:
 * archive it first. */
export const LISTING_CANNOT_DELETE_ACTIVE =
  "error.409.listing_cannot_delete_active";

/**
 * The publish refusal that is NOT a per-field verdict.
 *
 * `publish` answers an invalid draft with a bare `ValidationBatchResult`; this
 * code is what it answers when the PROMOTION fails afterwards — today that
 * means `REQUIRE_IMAGE_ON_PUBLISH` with an empty gallery. Two 400s, two
 * meanings; `model/validation.ts`'s `publishRefusal` is the one place that
 * tells them apart.
 */
export const LISTING_PUBLISH_VALIDATION_FAILED =
  "error.400.publish_validation_failed";

/** Somebody else's listing. Every owner operation routes through
 * `views._get_own` — except `PUT`/`PATCH`, which is why this pair does not
 * call them (`api/listingsApi.ts`). */
export const LISTING_NOT_OWNER = "error.403.listing_not_owner";

/**
 * Resolve a backend error code to its remediation hint, or `undefined` for a
 * code this module doesn't know (e.g. a cross-cutting `stapel.http.*`
 * fallback). Zero guessing at runtime — a static lookup over the generated map.
 */
export function explainListingsError(code: string): Remediation | undefined {
  return (LISTINGS_ERRORS as Record<string, { remediation: Remediation }>)[code]
    ?.remediation;
}
