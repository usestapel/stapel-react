import { describe, expect, it } from "vitest";
import { currenciesI18nBundleEn } from "../src/i18n/keys.js";
import {
  CURRENCIES_ERROR_CODES,
  currenciesErrorBundleEn,
  explainCurrenciesError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `currenciesI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every CURRENCIES_ERROR_CODE resolves in currenciesI18nBundleEn", () => {
    const missing = CURRENCIES_ERROR_CODES.filter(
      (code) => !(code in currenciesI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(currenciesErrorBundleEn).sort()).toEqual(
      [...CURRENCIES_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of CURRENCIES_ERROR_CODES) {
      expect(explainCurrenciesError(code), code).toBeDefined();
    }
  });
});
