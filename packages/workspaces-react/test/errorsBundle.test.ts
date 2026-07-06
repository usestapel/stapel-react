import { describe, expect, it } from "vitest";
import { workspacesI18nBundleEn } from "../src/i18n/keys.js";
import {
  WORKSPACES_ERROR_CODES,
  workspacesErrorBundleEn,
  explainWorkspacesError,
} from "../src/i18n/errorsMap.js";

/**
 * The teeth of the errors drift gate (frontend-core-architecture §2.5, §4c):
 * every backend error key the pair knows about ALSO has an English fallback in
 * the i18n bundle. Combined with `pnpm gen:errors:check` (a NEW backend key = a
 * red diff), a backend key can never reach the host as a raw, untranslated key.
 * A hand-edit that drops the generated spread from `workspacesI18nBundleEn` fails
 * here.
 */
describe("backend error keys all have an en fallback", () => {
  it("every WORKSPACES_ERROR_CODE resolves in workspacesI18nBundleEn", () => {
    const missing = WORKSPACES_ERROR_CODES.filter(
      (code) => !(code in workspacesI18nBundleEn)
    );
    expect(missing).toEqual([]);
  });

  it("the generated fallback bundle covers exactly the registry", () => {
    expect(Object.keys(workspacesErrorBundleEn).sort()).toEqual(
      [...WORKSPACES_ERROR_CODES].sort()
    );
  });

  it("explains a remediation for every generated code", () => {
    for (const code of WORKSPACES_ERROR_CODES) {
      expect(explainWorkspacesError(code), code).toBeDefined();
    }
  });
});
