// @stapel/eslint-plugin — the enforcement tier of the frontend guardrails
// (frontend-guardrails §2). Rules are data-driven: they read the same generated
// manifests (@stapel/tokens/manifest.json, pair i18n key registries) the
// codegen writes, so lint and code never drift. Ships a flat-config
// `recommended` preset; the stylelint preset lives at @stapel/eslint-plugin/
// stylelint.
import noRawColors from "./rules/no-raw-colors.js";
import noRawTokenImport from "./rules/no-raw-token-import.js";
import noRawFetch from "./rules/no-raw-fetch.js";
import i18nKeyExists from "./rules/i18n-key-exists.js";
import noHardcodedText from "./rules/no-hardcoded-text.js";
import requireDisableDescription from "./rules/require-disable-description.js";
import clickableNeedsEvent from "./rules/clickable-needs-event.js";
import noDoubleCount from "./rules/no-double-count.js";
import eventLiteralMeta from "./rules/event-literal-meta.js";
import knownEvent from "./rules/known-event.js";

const rules = {
  "no-raw-colors": noRawColors,
  "no-raw-token-import": noRawTokenImport,
  "no-raw-fetch": noRawFetch,
  "i18n-key-exists": i18nKeyExists,
  "no-hardcoded-text": noHardcodedText,
  "require-disable-description": requireDisableDescription,
  // Typed-analytics guardrails (frontend-guardrails §3, task G4).
  "clickable-needs-event": clickableNeedsEvent,
  "no-double-count": noDoubleCount,
  "event-literal-meta": eventLiteralMeta,
  "known-event": knownEvent,
};

const plugin = {
  meta: { name: "@stapel/eslint-plugin", version: "0.1.0" },
  rules,
};

const TS_JS = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];
const JSX = ["**/*.{tsx,jsx}"];

// Tests and fixtures legitimately exercise the anti-patterns these rules
// forbid — raw ramps as validator input, deliberately-unknown i18n keys,
// throwaway JSX copy — so the guardrails are scoped off there. Product source,
// demos (`demo/`), and the showcase stay covered.
const TEST_FILES = [
  "**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/fixtures/**",
  "**/*.fixture.{ts,tsx,js,jsx}",
];

// Files that are ALLOWED to reach the raw ramps (theme config + showcase +
// build scripts) — no-raw-token-import is off here (§2.2 overrides).
const RAW_ALLOWED = [
  "**/theme/**",
  "**/*.theme.{ts,tsx,js,mjs,json}",
  "**/stapel.theme.*",
  "**/tokens/**",
  "**/demo/**",
  "**/demos/**",
  "**/*.demo.{ts,tsx,jsx}",
  "**/showcase/**",
  "**/scripts/**",
  "**/*.stories.{ts,tsx,jsx}",
];

// The codegen API layer — the one legal home of fetch (§2.2 override).
const FETCH_ALLOWED = [
  "**/api/**",
  "**/*client.{ts,js}",
  "**/analytics/providers.{ts,js}",
  "**/scripts/**",
];

/**
 * Flat-config `recommended` preset. Consumers spread it AFTER their parser
 * config:
 *
 *   import stapel from "@stapel/eslint-plugin";
 *   export default [ ...tseslint.configs.strict, ...stapel.configs.recommended ];
 */
const recommended = [
  { plugins: { stapel: plugin } },
  {
    files: TS_JS,
    rules: {
      "stapel/no-raw-colors": "error",
      "stapel/no-raw-token-import": "error",
      "stapel/no-raw-fetch": "error",
      "stapel/i18n-key-exists": "error",
      "stapel/require-disable-description": "error",
      // Typed analytics (§3). Literal-meta keeps events statically extractable;
      // double-count is a hard ban (Q12а); known-event is drift → warn (goes
      // green after `pnpm gen:events`). These fire on .ts (defineEvent, track).
      "stapel/event-literal-meta": "error",
      "stapel/no-double-count": "error",
      "stapel/known-event": "warn",
    },
  },
  {
    files: JSX,
    rules: {
      "stapel/no-hardcoded-text": "error",
      // Clickable-without-an-outcome is a JSX concern (§3.2).
      "stapel/clickable-needs-event": "error",
    },
  },
  {
    files: RAW_ALLOWED,
    rules: { "stapel/no-raw-token-import": "off" },
  },
  {
    files: FETCH_ALLOWED,
    rules: { "stapel/no-raw-fetch": "off" },
  },
  {
    files: TEST_FILES,
    rules: {
      "stapel/no-raw-colors": "off",
      "stapel/no-hardcoded-text": "off",
      "stapel/i18n-key-exists": "off",
      "stapel/no-raw-fetch": "off",
      "stapel/no-raw-token-import": "off",
      // Fixtures / headless test factories legitimately train the analytics
      // anti-patterns (dynamic defineEvent, deliberate double-count, unknown
      // events, un-tracked clickables) — off there, on in product/demos.
      "stapel/clickable-needs-event": "off",
      "stapel/event-literal-meta": "off",
      "stapel/no-double-count": "off",
      "stapel/known-event": "off",
      // require-disable-description stays ON — disable hygiene applies everywhere.
    },
  },
];

plugin.configs = { recommended };

export default plugin;
export { rules, recommended };
