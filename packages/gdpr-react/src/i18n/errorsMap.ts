/**
 * The pair's error map (frontend-standard §4 checklist #7, frontend-core §2.5):
 * the generated `code → { status, params, remediation, en }` catalog plus a
 * tiny `explain()` lookup. Backs the manifest `errors` block and gives hosts a
 * mechanical UX branch beside `t(code, params)`. The map itself is generated
 * from the backend registry (`pnpm gen:errors`); this file only adds the lookup
 * helper and re-exports the public surface.
 *
 * The remediation is worth more here than in most pairs: `fix_input` on the
 * two vocabulary refusals, `contact_support` on `erasure_forbidden` — the
 * module DECLARES that an authorizer's refusal is not something the person can
 * fix by trying again, and a skin that reads it routes them somewhere useful
 * instead of offering a retry button.
 */
import { GDPR_ERRORS } from "./generated/errors.gen.js";
import type { Remediation } from "./generated/errors.gen.js";

export {
  GDPR_ERRORS,
  GDPR_ERROR_CODES,
  gdprErrorBundleEn,
} from "./generated/errors.gen.js";
export type {
  GdprErrorCode,
  GdprErrorSpec,
  Remediation,
} from "./generated/errors.gen.js";

/**
 * Resolve a backend error code to its remediation hint, or `undefined` for a
 * code this module doesn't know (e.g. a cross-cutting `stapel.http.*`
 * fallback). Zero guessing at runtime — a static lookup over the generated map.
 */
export function explainGdprError(code: string): Remediation | undefined {
  return (GDPR_ERRORS as Record<string, { remediation: Remediation }>)[code]
    ?.remediation;
}
