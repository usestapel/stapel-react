import { describe } from "vitest";
import rule from "../rules/i18n-key-exists.js";
import { tsxTester, I18N_SETTINGS } from "./helpers.js";

// A catalogue with a plural family and a computed-key family, so the argument
// forms below have something real to resolve against.
const SETTINGS = {
  stapel: {
    i18nKeys: [
      ...I18N_SETTINGS.stapel.i18nKeys,
      "auth.session.count.one",
      "auth.session.count.other",
      "auth.factor.kind-totp",
      "auth.factor.kind-passkey",
    ],
  },
};

describe("i18n-key-exists", () => {
  tsxTester().run("stapel/i18n-key-exists", rule, {
    valid: [
      // Known keys.
      { code: `t("auth.otp.enter_code");`, settings: I18N_SETTINGS },
      { code: `t("error.400.invalid_code");`, settings: I18N_SETTINGS },
      // Unmanaged namespace → assumed app-local, never flagged (FP policy).
      { code: `t("myapp.custom.title");`, settings: I18N_SETTINGS },
      // Dynamic key → skipped by default (documented policy, see the rule).
      { code: `t(key);`, settings: I18N_SETTINGS },
      { code: `t(labels[kind]);`, settings: I18N_SETTINGS },
      // No registry loaded → no-op, unless the project asks to be told.
      { code: `t("auth.whatever");`, settings: { stapel: { i18nKeys: [] } } },

      // Both branches of a ternary are literals, and both exist.
      {
        code: `t(totp ? "auth.factor.kind-totp" : "auth.factor.kind-passkey");`,
        settings: SETTINGS,
      },
      // A template key: the family it draws from exists.
      { code: "t(`auth.factor.kind-${kind}`);", settings: SETTINGS },
      // …and one under a namespace nobody manages stays app-local.
      { code: "t(`myapp.thing-${kind}`);", settings: SETTINGS },
      // A plural call names the FAMILY; `.other` is what must exist.
      { code: `tPlural("auth.session.count", n);`, settings: SETTINGS },
      // A no-substitution template is just a literal.
      { code: "t(`auth.otp.enter_code`);", settings: I18N_SETTINGS },
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
      // The branch that was never rendered in review is still a key.
      {
        code: `t(totp ? "auth.factor.kind-totp" : "auth.factor.kind-passkeys");`,
        settings: SETTINGS,
        errors: [{ messageId: "unknownKey" }],
      },
      // The family a computed key draws from was renamed away.
      {
        code: "t(`auth.factor.type-${kind}`);",
        settings: SETTINGS,
        errors: [{ messageId: "unknownPrefix" }],
      },
      // A plural family with no `.other` — the one form every locale defines.
      {
        code: `tPlural("auth.session.total", n);`,
        settings: SETTINGS,
        errors: [{ messageId: "unknownPluralKey" }],
      },
      // Opt-in: an unresolvable key is SAID, under its own message, so a
      // project can decide what to do about it.
      {
        code: `t(key);`,
        options: [{ dynamicKeys: "report" }],
        settings: SETTINGS,
        errors: [{ messageId: "dynamicKey" }],
      },
      // The no-op trap. A rule listed in a config with no catalogue behind it
      // checks nothing, and looks exactly like a rule that passes — which is
      // how a raw dotted key reached a production stand.
      {
        code: `t("auth.otp.enter_code");`,
        options: [{ requireRegistry: true }],
        settings: { stapel: { i18nKeys: [] } },
        errors: [{ messageId: "noRegistry" }],
      },
    ],
  });
});
