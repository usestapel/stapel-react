import { describe, expect, it } from "vitest";
import { moderationI18nBundleEn } from "../src/i18n/keys.js";
import {
  MODERATION_ERROR_CODES,
  moderationErrorBundleEn,
  explainModerationError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `moderationI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every MODERATION_ERROR_CODE resolves in moderationI18nBundleEn", () => {
    const missing = MODERATION_ERROR_CODES.filter(
      (code) => !(code in moderationI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(moderationErrorBundleEn).sort()).toEqual(
      [...MODERATION_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of MODERATION_ERROR_CODES) {
      expect(explainModerationError(code), code).toBeDefined();
    }
  });
});
