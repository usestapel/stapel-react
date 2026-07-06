/**
 * The pair's error map (frontend-standard §4 checklist #7, frontend-core
 * §2.5): the generated `code → { status, params, remediation, en }` catalog
 * plus a tiny `explain()` lookup. Backs the manifest `errors` block and gives
 * hosts a mechanical UX branch beside `t(code, params)`. The map itself is
 * generated from the backend registry (`pnpm gen:errors`); this file only adds
 * the lookup helper and re-exports the public surface.
 */
import { AUTH_ERRORS } from "./generated/errors.gen.js";
import type { Remediation } from "./generated/errors.gen.js";

export {
  AUTH_ERRORS,
  AUTH_ERROR_CODES,
  authErrorBundleEn,
} from "./generated/errors.gen.js";
export type {
  AuthErrorCode,
  AuthErrorSpec,
  Remediation,
} from "./generated/errors.gen.js";

/**
 * Resolve a backend error code to its remediation hint, or `undefined` for a
 * code this module doesn't know (e.g. a cross-cutting `stapel.http.*` fallback).
 * Zero guessing at runtime — a static lookup over the generated map.
 */
export function explainAuthError(code: string): Remediation | undefined {
  return (AUTH_ERRORS as Record<string, { remediation: Remediation }>)[code]
    ?.remediation;
}
