import { describe, expect, it } from "vitest";
import { gdprI18nBundleEn } from "../src/i18n/keys.js";
import {
  GDPR_ERRORS,
  GDPR_ERROR_CODES,
  gdprErrorBundleEn,
  explainGdprError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `gdprI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every GDPR_ERROR_CODE resolves in gdprI18nBundleEn", () => {
    const missing = GDPR_ERROR_CODES.filter(
      (code) => !(code in gdprI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(gdprErrorBundleEn).sort()).toEqual(
      [...GDPR_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of GDPR_ERROR_CODES) {
      expect(explainGdprError(code), code).toBeDefined();
    }
  });

  it("returns nothing for a code this module does not know", () => {
    expect(explainGdprError("error.418.teapot")).toBeUndefined();
  });
});

/**
 * The remediations the SKIN's advice is built on. These are declared by the
 * backend on its own registry, so a change upstream changes the advice a
 * product gives — which is the point, and why they are asserted rather than
 * mirrored in a constant here.
 */
describe("the module declares what a person can actually do about a refusal", () => {
  it("an authorizer's refusal is not something to retry", () => {
    // `ERASURE_AUTHORIZER` defaults to staff-only, so this usually means the
    // HOST has not plugged in its ownership predicate. Retrying cannot fix it.
    expect(GDPR_ERRORS["error.403.gdpr.erasure_forbidden"]?.remediation).toBe(
      "contact_support"
    );
  });

  it("the two vocabulary refusals are client-side mistakes", () => {
    expect(GDPR_ERRORS["error.400.gdpr.unknown_subject_type"]?.remediation).toBe(
      "fix_input"
    );
    expect(GDPR_ERRORS["error.400.gdpr.unknown_dsar_kind"]?.remediation).toBe(
      "fix_input"
    );
  });
});

/**
 * The statuses this pair refuses to branch on. The registry is where the
 * collisions are visible: three 404s that mean three different things, two
 * 409s, two 410s. If a future backend release collapsed any of these pairs
 * onto one code, the predicates in `model/refusals.ts` would silently start
 * covering two situations — so the shape is asserted here.
 */
describe("the collisions that force reading by code", () => {
  it("three different 404s", () => {
    const notFound = GDPR_ERROR_CODES.filter(
      (code) => code.includes(".gdpr.") && GDPR_ERRORS[code]?.status === 404
    );
    expect(notFound.length).toBeGreaterThanOrEqual(3);
    expect(notFound).toContain("error.404.gdpr.no_active_closure");
    expect(notFound).toContain("error.404.gdpr.export_not_found");
    expect(notFound).toContain("error.404.gdpr.erasure_not_found");
  });

  it("two 409s that are a no-op and a legal refusal", () => {
    expect(GDPR_ERRORS["error.409.gdpr.closure_already_pending"]?.status).toBe(409);
    expect(GDPR_ERRORS["error.409.gdpr.legal_hold"]?.status).toBe(409);
  });

  it("two 410s that are opposite advice", () => {
    expect(GDPR_ERRORS["error.410.gdpr.download_consumed"]?.status).toBe(410);
    expect(GDPR_ERRORS["error.410.gdpr.download_expired"]?.status).toBe(410);
  });
});
