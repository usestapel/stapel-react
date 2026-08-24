import { describe, expect, it } from "vitest";
import { tasksI18nBundleEn } from "../src/i18n/keys.js";
import {
  TASKS_ERROR_CODES,
  tasksErrorBundleEn,
  explainTasksError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `tasksI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every TASKS_ERROR_CODE resolves in tasksI18nBundleEn", () => {
    const missing = TASKS_ERROR_CODES.filter(
      (code) => !(code in tasksI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(tasksErrorBundleEn).sort()).toEqual(
      [...TASKS_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of TASKS_ERROR_CODES) {
      expect(explainTasksError(code), code).toBeDefined();
    }
  });
});
