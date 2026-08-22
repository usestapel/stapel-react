/**
 * The pair's error map (frontend-standard §4 checklist #7, frontend-core
 * §2.5): the generated `code → { status, params, remediation, en }` catalog
 * plus a tiny `explain()` lookup. Backs the manifest `errors` block and gives
 * hosts a mechanical UX branch beside `t(code, params)`. The map itself is
 * generated from the backend registry (`pnpm gen:errors`); this file only
 * adds the lookup helper and re-exports the public surface.
 */
import { SEARCH_ERRORS } from "./generated/errors.gen.js";
import type { Remediation } from "./generated/errors.gen.js";

export {
  SEARCH_ERRORS,
  SEARCH_ERROR_CODES,
  searchErrorBundleEn,
} from "./generated/errors.gen.js";
export type {
  SearchErrorCode,
  SearchErrorSpec,
  Remediation,
} from "./generated/errors.gen.js";

/**
 * The window refusal, named because a skin MUST branch on it.
 *
 * `error.400.search_window_exceeded` means "you have paged past
 * `MAX_RESULT_WINDOW`", and its `params.window` carries the depth. Rendered as
 * an empty result page it reads as "there is nothing here", which is false and
 * is the exact substitution `matchList` exists to prevent — so it gets a
 * constant rather than a string somebody retypes at each call site.
 */
export const SEARCH_WINDOW_EXCEEDED = "error.400.search_window_exceeded";

/**
 * The engine is down. Distinct from "no results" in the same way
 * `LoadFailed` is distinct from an empty list — the views turn EVERY backend
 * exception into this 503, so a client never has to guess whether a blank
 * page meant an outage.
 */
export const SEARCH_BACKEND_UNAVAILABLE = "error.503.search_backend_unavailable";

/**
 * Resolve a backend error code to its remediation hint, or `undefined` for a
 * code this module doesn't know (e.g. a cross-cutting `stapel.http.*`
 * fallback). Zero guessing at runtime — a static lookup over the generated map.
 */
export function explainSearchError(code: string): Remediation | undefined {
  return (SEARCH_ERRORS as Record<string, { remediation: Remediation }>)[code]
    ?.remediation;
}
