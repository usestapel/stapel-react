/**
 * The pair's error map (frontend-standard §4 checklist #7, frontend-core
 * §2.5) — normally GENERATED from the backend's `docs/errors.json` by
 * `pnpm gen:errors`. stapel-docs does not emit that artifact yet, so the map
 * is EMPTY by design: inventing error codes the backend never declared would
 * be fabrication, not coverage. `StapelApiError`s still render — core's
 * `stapel.http.<status>` fallback and this pair's `docs.error.unknown` copy
 * cover the gap. FOLLOW-UP (with `api/types.ts`): enroll the pair in the
 * root `gen:errors` driver once the backend commits its error registry, move
 * this surface onto `./generated/errors.gen.js`, and delete the hand-written
 * shapes below.
 */

/** Remediation vocabulary (frontend-core-architecture §2.5) — mirrors the
 * generated emitters' union so the surface is source-compatible with the
 * post-enrollment shape. */
export type Remediation =
  | "retry"
  | "wait_and_retry"
  | "reauthenticate"
  | "verify"
  | "fix_input"
  | "contact_support"
  | "bug";

export interface DocsErrorSpec {
  /** HTTP status the backend raises this key with. */
  readonly status: number;
  /** `{param}` interpolation slots present in the message. */
  readonly params: readonly string[];
  /** Remediation hint declared by the backend. */
  readonly remediation: Remediation;
  /** English fallback. */
  readonly en: string;
}

/** Empty until stapel-docs commits its error registry (see file header). */
export const DOCS_ERRORS: Readonly<Record<string, DocsErrorSpec>> = {};

export type DocsErrorCode = keyof typeof DOCS_ERRORS;

/** Every code in {@link DOCS_ERRORS} (none yet), sorted. */
export const DOCS_ERROR_CODES: readonly string[] = Object.keys(DOCS_ERRORS).sort();

/** English fallback bundle derived from {@link DOCS_ERRORS} (empty for now —
 * `docs.error.unknown` in `keys.ts` is the pair-level fallback). */
export const docsErrorBundleEn: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(DOCS_ERRORS).map(([code, spec]) => [code, spec.en])
  );

/**
 * Resolve a backend error code to its remediation hint, or `undefined` for a
 * code this module doesn't know (today: every code — see the file header).
 * Zero guessing at runtime — a static lookup over the map.
 */
export function explainDocsError(code: string): Remediation | undefined {
  return DOCS_ERRORS[code]?.remediation;
}
