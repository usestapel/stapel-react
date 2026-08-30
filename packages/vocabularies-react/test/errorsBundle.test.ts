import { describe, expect, it } from "vitest";
import { vocabulariesI18nBundleEn } from "../src/i18n/keys.js";
import {
  VOCABULARIES_ERROR_CODES,
  vocabulariesErrorBundleEn,
  explainVocabulariesError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `vocabulariesI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every VOCABULARIES_ERROR_CODE resolves in vocabulariesI18nBundleEn", () => {
    const missing = VOCABULARIES_ERROR_CODES.filter(
      (code) => !(code in vocabulariesI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(vocabulariesErrorBundleEn).sort()).toEqual(
      [...VOCABULARIES_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of VOCABULARIES_ERROR_CODES) {
      expect(explainVocabulariesError(code), code).toBeDefined();
    }
  });
});
