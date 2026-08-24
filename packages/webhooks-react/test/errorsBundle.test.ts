import { describe, expect, it } from "vitest";
import { webhooksI18nBundleEn } from "../src/i18n/keys.js";
import {
  WEBHOOKS_ERROR_CODES,
  webhooksErrorBundleEn,
  explainWebhooksError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `webhooksI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every WEBHOOKS_ERROR_CODE resolves in webhooksI18nBundleEn", () => {
    const missing = WEBHOOKS_ERROR_CODES.filter(
      (code) => !(code in webhooksI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(webhooksErrorBundleEn).sort()).toEqual(
      [...WEBHOOKS_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of WEBHOOKS_ERROR_CODES) {
      expect(explainWebhooksError(code), code).toBeDefined();
    }
  });
});
