import { describe, expect, it } from "vitest";
import { billingI18nBundleEn } from "../src/i18n/keys.js";
import {
  BILLING_ERROR_CODES,
  billingErrorBundleEn,
  explainBillingError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `billingI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every BILLING_ERROR_CODE resolves in billingI18nBundleEn", () => {
    const missing = BILLING_ERROR_CODES.filter(
      (code) => !(code in billingI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(billingErrorBundleEn).sort()).toEqual(
      [...BILLING_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of BILLING_ERROR_CODES) {
      expect(explainBillingError(code), code).toBeDefined();
    }
  });
});
