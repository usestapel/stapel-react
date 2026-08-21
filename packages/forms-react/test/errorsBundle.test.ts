import { describe, expect, it } from "vitest";
import { formsI18nBundleEn } from "../src/i18n/keys.js";
import {
  FORMS_ERROR_CODES,
  formsErrorBundleEn,
  explainFormsError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `formsI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every FORMS_ERROR_CODE resolves in formsI18nBundleEn", () => {
    const missing = FORMS_ERROR_CODES.filter(
      (code) => !(code in formsI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(formsErrorBundleEn).sort()).toEqual(
      [...FORMS_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of FORMS_ERROR_CODES) {
      expect(explainFormsError(code), code).toBeDefined();
    }
  });
});
