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
import type { DocsErrorCode, Remediation } from "./generated/errors.gen.js";

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

/**
 * The four share refusals a sheet must render BY NAME rather than as
 * "something went wrong" — each names a different remedy: a mode nobody in
 * the sheet can switch on, a level to retry one step lower, a form that sent
 * both subject fields or neither, and a reference kind this host never
 * registered a resolver for.
 *
 * Typed as {@link DocsErrorCode}, so the four are checked against the
 * GENERATED registry at compile time: if stapel-docs renames one, this stops
 * building instead of silently falling through to the generic branch.
 */
export const DOCS_SHARE_ERROR_CODES: {
  readonly modeDisabled: DocsErrorCode;
  readonly level: DocsErrorCode;
  readonly subject: DocsErrorCode;
  readonly refKind: DocsErrorCode;
} = {
  modeDisabled: "error.400.docs_share_mode_disabled",
  level: "error.400.docs_share_level",
  subject: "error.400.docs_share_subject",
  refKind: "error.400.docs_share_ref_kind",
};
