/**
 * The pair's error map (frontend-standard §4 checklist #7, frontend-core
 * §2.5): the generated `code → { status, params, remediation, en }` catalog
 * plus a tiny `explain()` lookup. Backs the manifest `errors` block and gives
 * hosts a mechanical UX branch beside `t(code, params)`.
 *
 * The map is GENERATED from the backend registry (`pnpm gen:errors` over
 * `stapel-docs/docs/errors.json`, drift-gated by `pnpm gen:errors:check`);
 * this file only re-exports the public surface and adds the lookup helper.
 * It used to be an empty hand-written stand-in — which is why a lost save
 * race (`error.409.docs_seq_conflict`) and an exhausted workspace
 * (`error.507.docs_workspace_quota`) both rendered as "Something went wrong".
 */
import { DOCS_ERRORS } from "./generated/errors.gen.js";
import type { Remediation } from "./generated/errors.gen.js";

export {
  DOCS_ERRORS,
  DOCS_ERROR_CODES,
  docsErrorBundleEn,
} from "./generated/errors.gen.js";
export type {
  DocsErrorCode,
  DocsErrorSpec,
  Remediation,
} from "./generated/errors.gen.js";

/**
 * Resolve a backend error code to its remediation hint, or `undefined` for a
 * code this module doesn't know (a cross-cutting `stapel.http.*` fallback, or
 * one of the pair's own client-side rules — `docs.error.unknown` is not a
 * backend code and deliberately has no entry here).
 */
export function explainDocsError(code: string): Remediation | undefined {
  return (DOCS_ERRORS as Record<string, { remediation: Remediation }>)[code]
    ?.remediation;
}
