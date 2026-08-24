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

// A small token catalog matching the real @stapel/tokens manifest shape (§68
// neutral role dictionary — no ad-hoc names, no L3 component tier), so rule
// tests don't depend on filesystem discovery.
export const TOKEN_SETTINGS = {
  stapel: {
    tokensManifest: {
      tokens: {
        core: ["brand", "surface", "surface-raised", "text", "text-muted"],
        component: [],
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

// A reserved-backend-path catalog matching reserved-paths.json's flat
// `reservedPathPrefixes` shape, so no-reserved-backend-route tests don't
// depend on filesystem discovery. Bare module roots ("/calendar") are
// deliberately ABSENT — only their sub-paths are reserved (canon: roots are
// the frontend's).
export const RESERVED_PATH_SETTINGS = {
  stapel: {
    reservedPaths: [
      "/admin",
      "/staticfiles",
      "/media",
      "/calendar/api",
      "/calendar/swagger",
      "/billing/api",
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

// The dimension scales, matching theme.default.json's `scales` shape, so
// no-raw-dimensions tests do not depend on filesystem discovery and the
// autofix asserts against known numbers.
export const SCALE_SETTINGS = {
  stapel: {
    scales: {
      spacing: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 },
      radii: { none: 0, sm: 4, md: 8, lg: 12, xl: 20, full: 9999 },
      fontSize: {
        xs: { fontSize: 12, lineHeight: 16 },
        sm: { fontSize: 14, lineHeight: 20 },
        md: { fontSize: 16, lineHeight: 24 },
        "2xl": { fontSize: 28, lineHeight: 36 },
      },
    },
  },
};
