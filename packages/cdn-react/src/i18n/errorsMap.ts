/**
 * The pair's error map (frontend-standard §4 checklist #7): the generated
 * `code → { status, params, remediation, en }` catalog plus a tiny `explain()`
 * lookup. Backs the manifest `errors` block and gives hosts a mechanical UX
 * branch beside `t(code, params)`. The map itself is generated from the
 * backend registry (`pnpm gen:errors`); this file only adds the lookup helper
 * and re-exports the public surface.
 */
import { CDN_ERRORS } from "./generated/errors.gen.js";
import type { Remediation } from "./generated/errors.gen.js";

export {
  CDN_ERRORS,
  CDN_ERROR_CODES,
  cdnErrorBundleEn,
} from "./generated/errors.gen.js";
export type {
  CdnErrorCode,
  CdnErrorSpec,
  Remediation,
} from "./generated/errors.gen.js";

/**
 * Resolve a backend error code to its remediation hint, or `undefined` for a
 * code this module doesn't know (a cross-cutting `stapel.http.*` fallback, or
 * one of this pair's own client-side rules such as
 * `cdn.upload.blocked.full` — which is not a backend code and deliberately
 * has no entry here).
 */
export function explainCdnError(code: string): Remediation | undefined {
  return (CDN_ERRORS as Record<string, { remediation: Remediation }>)[code]
    ?.remediation;
}
