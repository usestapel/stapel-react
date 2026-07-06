import { describe } from "vitest";
import rule from "../rules/i18n-key-exists.js";
import { tsxTester, I18N_SETTINGS } from "./helpers.js";

describe("i18n-key-exists", () => {
  tsxTester().run("stapel/i18n-key-exists", rule, {
    valid: [
      // Known keys.
      { code: `t("auth.otp.enter_code");`, settings: I18N_SETTINGS },
      { code: `t("error.400.invalid_code");`, settings: I18N_SETTINGS },
      // Unmanaged namespace → assumed app-local, never flagged (FP policy).
      { code: `t("myapp.custom.title");`, settings: I18N_SETTINGS },
      // Dynamic key → skipped.
      { code: `t(key);`, settings: I18N_SETTINGS },
      // No registry loaded → no-op.
      { code: `t("auth.whatever");`, settings: { stapel: { i18nKeys: [] } } },
    ],
    invalid: [
      // Typo in a MANAGED namespace ("auth" is owned).
      {
        code: `t("auth.otp.enter_codee");`,
        settings: I18N_SETTINGS,
        errors: [{ messageId: "unknownKey" }],
      },
      {
        code: `i18n.t("error.404.nope");`,
        settings: I18N_SETTINGS,
        errors: [{ messageId: "unknownKey" }],
      },
    ],
  });
});
