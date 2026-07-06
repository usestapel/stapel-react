import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { afterAll, describe, it } from "vitest";

// Wire ESLint's RuleTester into vitest's runner so `.run()` registers real
// vitest test cases.
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

/** RuleTester wired for TS + JSX, matching the monorepo parser. */
export function tsxTester() {
  return new RuleTester({
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  });
}

// A small token catalog matching the real @stapel/tokens manifest shape, so
// rule tests don't depend on filesystem discovery.
export const TOKEN_SETTINGS = {
  stapel: {
    tokensManifest: {
      tokens: {
        core: ["accent", "background-primary", "text-primary"],
        component: ["button-primary-bg", "card-bg"],
      },
      ramps: { names: ["gray", "brand", "blue", "red", "green", "amber", "scrim"] },
    },
  },
};

export const I18N_SETTINGS = {
  stapel: {
    i18nKeys: [
      "auth.otp.enter_code",
      "auth.password.label",
      "error.400.invalid_code",
    ],
  },
};

// An operation-path catalog matching the manifest.operations projection shape,
// so no-string-paths tests don't depend on filesystem discovery. Paths carry
// the backend prefix (`/auth/api/…`); client-relative literals (`/me/`) match by
// trailing-segment suffix.
export const OPERATION_SETTINGS = {
  stapel: {
    operationsManifests: [
      {
        package: "@stapel/auth-react",
        operations: {
          me: { method: "GET", path: "/auth/api/me/" },
          capabilities: { method: "GET", path: "/auth/api/capabilities/" },
        },
      },
    ],
  },
};

// A known-event catalog matching the manifest.events projection shape, so
// known-event tests don't depend on filesystem discovery. `defined` names are
// exact; `flows[].event` bases match by prefix (flow.<id>.<step>).
export const EVENT_SETTINGS = {
  stapel: {
    eventsManifests: [
      {
        events: {
          defined: [
            { name: "pricing.plan.selected" },
            { name: "auth.login.submitted" },
          ],
          flows: [{ flow: "auth.otp", event: "flow.auth.otp.<step>" }],
        },
      },
    ],
  },
};
