import { describe, expect, it } from "vitest";
import { chatI18nBundleEn } from "../src/i18n/keys.js";
import {
  CHAT_ERROR_CODES,
  chatErrorBundleEn,
  explainChatError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 */
describe("backend error keys all have an en fallback", () => {
  it("every CHAT_ERROR_CODE resolves in chatI18nBundleEn", () => {
    const missing = CHAT_ERROR_CODES.filter((code) => !(code in chatI18nBundleEn));
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(chatErrorBundleEn).sort()).toEqual([...CHAT_ERROR_CODES].sort());
  });

  it("explains a remediation for every generated code", () => {
    for (const code of CHAT_ERROR_CODES) {
      expect(explainChatError(code), code).toBeDefined();
    }
  });

  it("says nothing about a code it does not own", () => {
    expect(explainChatError("error.418.teapot")).toBeUndefined();
  });
});
