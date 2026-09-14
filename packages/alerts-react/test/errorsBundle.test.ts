import { describe, expect, it } from "vitest";
import { alertsI18nBundleEn } from "../src/i18n/keys.js";
import {
  ALERTS_ERROR_CODES,
  alertsErrorBundleEn,
  explainAlertsError,
} from "../src/i18n/errorsMap.js";
import {
  ALERTS_ERROR_FORBIDDEN,
  ALERTS_ERROR_ISSUE_NOT_FOUND,
  ALERTS_ERROR_STATUS_NOT_SETTABLE,
  ALERTS_ERROR_UNAUTHORIZED,
} from "../src/model/refusals.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 */
describe("backend error keys all have an en fallback", () => {
  it("every ALERTS_ERROR_CODE resolves in alertsI18nBundleEn", () => {
    const missing = ALERTS_ERROR_CODES.filter(
      (code) => !(code in alertsI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(alertsErrorBundleEn).sort()).toEqual(
      [...ALERTS_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of ALERTS_ERROR_CODES) {
      expect(explainAlertsError(code), code).toBeDefined();
    }
  });
});

describe("the named refusals name codes the backend can actually raise", () => {
  it("each constant is a code in the generated registry", () => {
    // A named refusal for a code the backend does not have is a branch that
    // can never fire — the shape the "mock the wire" rule exists to catch.
    for (const code of [
      ALERTS_ERROR_STATUS_NOT_SETTABLE,
      ALERTS_ERROR_UNAUTHORIZED,
      ALERTS_ERROR_FORBIDDEN,
      ALERTS_ERROR_ISSUE_NOT_FOUND,
    ]) {
      expect(ALERTS_ERROR_CODES as readonly string[], code).toContain(code);
    }
  });

  it("the report endpoint's refusals are known, and belong to nobody here", () => {
    // `error.401.alerts_service_key_required` / `error.403.…_invalid` are the
    // reporters' refusals. They are in the catalogue (so a host renders them
    // if something else raises one) and the pair names NO helper for them: it
    // has no code path that can reach `POST /report`.
    expect(ALERTS_ERROR_CODES as readonly string[]).toContain(
      "error.401.alerts_service_key_required"
    );
    expect(ALERTS_ERROR_CODES as readonly string[]).toContain(
      "error.403.alerts_service_key_invalid"
    );
  });
});
