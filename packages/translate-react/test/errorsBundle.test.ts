import { describe, expect, it } from "vitest";
import { translateI18nBundleEn } from "../src/i18n/keys.js";
import {
  TRANSLATE_ERROR_CODES,
  translateErrorBundleEn,
  explainTranslateError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `translateI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every TRANSLATE_ERROR_CODE resolves in translateI18nBundleEn", () => {
    const missing = TRANSLATE_ERROR_CODES.filter(
      (code) => !(code in translateI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(translateErrorBundleEn).sort()).toEqual(
      [...TRANSLATE_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of TRANSLATE_ERROR_CODES) {
      expect(explainTranslateError(code), code).toBeDefined();
    }
  });
});
