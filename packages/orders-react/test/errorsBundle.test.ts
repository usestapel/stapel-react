import { describe, expect, it } from "vitest";
import { ordersI18nBundleEn } from "../src/i18n/keys.js";
import {
  ORDERS_ERROR_CODES,
  ordersErrorBundleEn,
  explainOrdersError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `ordersI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every ORDERS_ERROR_CODE resolves in ordersI18nBundleEn", () => {
    const missing = ORDERS_ERROR_CODES.filter(
      (code) => !(code in ordersI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(ordersErrorBundleEn).sort()).toEqual(
      [...ORDERS_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of ORDERS_ERROR_CODES) {
      expect(explainOrdersError(code), code).toBeDefined();
    }
  });
});
