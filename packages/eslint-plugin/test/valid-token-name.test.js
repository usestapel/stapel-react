import { describe } from "vitest";
import rule from "../rules/valid-token-name.js";
import { tsxTester, TOKEN_SETTINGS } from "./helpers.js";

describe("valid-token-name", () => {
  tsxTester().run("stapel/valid-token-name", rule, {
    valid: [
      // Current roles — cssVar() form.
      { code: `const x = <div style={{ color: cssVar("brand") }} />;`, settings: TOKEN_SETTINGS },
      { code: `const x = <div style={{ background: cssVar("surface-raised") }} />;`, settings: TOKEN_SETTINGS },
      // Current role — var(--stapel-*) form, in a plain string.
      { code: `const s = { color: "var(--stapel-text-muted)" };`, settings: TOKEN_SETTINGS },
      // ... and inside a CSS-in-JS tagged template.
      { code: "const s = css`color: var(--stapel-text-muted);`;", settings: TOKEN_SETTINGS },
      // A fallback value inside var(...) does not confuse the name capture.
      { code: `const s = { color: "var(--stapel-brand, blue)" };`, settings: TOKEN_SETTINGS },
      // Non-colour scale suffixes are a different, unpoliced vocabulary.
      { code: `const x = cssVar("radius-md");`, settings: TOKEN_SETTINGS },
      { code: `const s = { fontSize: "var(--stapel-font-size-lg)" };`, settings: TOKEN_SETTINGS },
      // Empty/unloaded catalog → no-op (never guesses, never crashes).
      {
        code: `const x = cssVar("whatever-not-in-any-catalog");`,
        settings: {
          stapel: {
            tokensManifest: { tokens: { core: [], component: [] }, ramps: { names: [] } },
          },
        },
      },
      // Not a tracked cssVar-style call at all.
      { code: `const x = notCssVar("accent");`, settings: TOKEN_SETTINGS },
    ],
    invalid: [
      // Legacy/renamed role name — cssVar() form.
      {
        code: `const x = <div style={{ color: cssVar("accent") }} />;`,
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "unknownToken", data: { name: "accent", form: "cssVar()", suggestion: "" } }],
      },
      // Legacy/renamed role name — var(--stapel-*) form.
      {
        code: `const s = { color: "var(--stapel-color-accent)" };`,
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "unknownToken", data: { name: "color-accent", form: "var(--stapel-*)", suggestion: "" } }],
      },
      // Removed L3 component tier.
      {
        code: `const x = cssVar("button-primary-bg");`,
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "unknownToken", data: { name: "button-primary-bg", form: "cssVar()", suggestion: "" } }],
      },
      // Plain typo close to a real role gets a suggestion.
      {
        code: `const x = cssVar("brnad");`,
        settings: TOKEN_SETTINGS,
        errors: [
          {
            messageId: "unknownToken",
            data: { name: "brnad", form: "cssVar()", suggestion: ' — did you mean "brand"?' },
          },
        ],
      },
      // var(--stapel-*) inside a CSS-in-JS template.
      {
        code: "const s = css`color: var(--stapel-upperground-1);`;",
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "unknownToken", data: { name: "upperground-1", form: "var(--stapel-*)", suggestion: "" } }],
      },
    ],
  });
});
