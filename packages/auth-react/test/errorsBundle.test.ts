import { describe, expect, it } from "vitest";
import { authI18nBundleEn } from "../src/i18n/keys.js";
import {
  AUTH_ERRORS,
  AUTH_ERROR_CODES,
  authErrorBundleEn,
  explainAuthError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * proves that every backend error key the pair knows about ALSO has an English
 * fallback in the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW
 * backend key = a red diff), this means a backend key can never reach the host
 * as a raw, untranslated key — the failure mode the pair review flagged (43
 * uncovered keys). A future hand-edit that drops the generated spread from
 * `authI18nBundleEn` fails here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every AUTH_ERROR_CODE resolves in authI18nBundleEn", () => {
    const missing = AUTH_ERROR_CODES.filter((code) => !(code in authI18nBundleEn));
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(authErrorBundleEn).sort()).toEqual(
      [...AUTH_ERROR_CODES].sort()
    );
  });

  it("params on a specced key match its message placeholders", () => {
    // Spot-check a param-bearing key so the extraction stays honest.
    const locked = AUTH_ERRORS["error.423.account_locked"];
    expect(locked.params).toContain("retry_after_minutes");
    expect(locked.remediation).toBe("wait_and_retry");
  });

  it("explainAuthError returns a remediation for known codes, undefined otherwise", () => {
    expect(explainAuthError("error.401.invalid_credentials")).toBe("reauthenticate");
    expect(explainAuthError("error.403.verification_required")).toBe("verify");
    expect(explainAuthError("stapel.http.500")).toBeUndefined();
  });
});
