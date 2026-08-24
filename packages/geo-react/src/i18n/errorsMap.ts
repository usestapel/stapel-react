/**
 * The pair's error map (frontend-standard §4 checklist #7): the generated
 * `code → { status, params, remediation, en }` catalog plus an `explain()`
 * lookup. Generated from stapel-geo's registry (`pnpm gen:errors`); this file
 * adds the lookup and re-exports the public surface.
 */
import { GEO_ERRORS } from "./generated/errors.gen.js";
import type { Remediation } from "./generated/errors.gen.js";

export {
  GEO_ERRORS,
  GEO_ERROR_CODES,
  geoErrorBundleEn,
} from "./generated/errors.gen.js";
export type { GeoErrorCode, GeoErrorSpec, Remediation } from "./generated/errors.gen.js";

/** The remediation hint for a backend code, or `undefined` for one this
 * module does not own (a cross-cutting `stapel.http.*` fallback). */
export function explain(code: string): Remediation | undefined {
  return (GEO_ERRORS as Record<string, { remediation?: Remediation }>)[code]?.remediation;
}
