/**
 * The pair's error map (frontend-standard §4 checklist #7, frontend-core
 * §2.5): the generated `code → { status, params, remediation, en }` catalog
 * plus a tiny `explain()` lookup. Backs the manifest `errors` block and gives
 * hosts a mechanical UX branch beside `t(code, params)`. The map itself is
 * generated from the backend registry (`pnpm gen:errors`); this file only adds
 * the lookup helper and re-exports the public surface.
 */
import { CATEGORIES_ERRORS } from "./generated/errors.gen.js";
import type { Remediation } from "./generated/errors.gen.js";

export {
  CATEGORIES_ERRORS,
  CATEGORIES_ERROR_CODES,
  categoriesErrorBundleEn,
} from "./generated/errors.gen.js";
export type {
  CategoriesErrorCode,
  CategoriesErrorSpec,
  Remediation,
} from "./generated/errors.gen.js";

/**
 * The optimistic-concurrency refusal of the feature editor, named because it
 * is the one 409 in the registry and it means something specific: somebody
 * else changed this category's schema while you were editing it, and
 * `params.expected` / `params.actual` say which revisions.
 *
 * Not raised by anything on this pair's surface (the feature editor is a staff
 * screen — see `api/categoriesApi.ts`), and exported anyway because the
 * catalogue admin a host builds on top of this client WILL meet it, and a
 * constant beats a string retyped at each call site.
 */
export const CATEGORIES_FEATURE_EDITOR_CONFLICT =
  "error.409.categories_feature_editor_conflict";

/**
 * Resolve a backend error code to its remediation hint, or `undefined` for a
 * code this module doesn't know (e.g. a cross-cutting `stapel.http.*`
 * fallback). Zero guessing at runtime — a static lookup over the generated map.
 */
export function explainCategoriesError(code: string): Remediation | undefined {
  return (CATEGORIES_ERRORS as Record<string, { remediation: Remediation }>)[
    code
  ]?.remediation;
}
