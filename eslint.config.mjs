// Root ESLint flat config for stapel-react.
// Packages run `eslint .` from their own directory; ESLint resolves this file
// by walking up, so the ruleset is shared without workspace-relative imports
// in package sources.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import stapel from "@stapel/eslint-plugin";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.css",
      // AUTO-GENERATED typed API surface (pnpm gen:api) — not hand-edited.
      "**/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "19" },
    },
    rules: {
      // frontend-standard §4.5: hooks discipline is mechanical, not manual.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      // frontend-standard §4.5: index keys are banned.
      "react/no-array-index-key": "error",
      "react/jsx-key": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Guardrail enforcement (no-raw-colors, no-literal-strings, no-raw-fetch,
      // i18n-key-exists, escape-hatch) is delivered by @stapel/eslint-plugin's
      // recommended preset, spread below (frontend-guardrails §2).
    },
  },
  {
    // Node-side build scripts and configs.
    files: ["**/*.mjs", "**/scripts/**"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    // @stapel/eslint-plugin's own JS source runs on Node.
    files: ["packages/eslint-plugin/**/*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
      },
    },
  },
  // Guardrail preset (frontend-guardrails §2): data-driven rules reading the
  // generated token/i18n manifests. Spread last so its file-scoped overrides
  // (raw-ramp imports in theme/showcase, fetch in the api layer) win.
  ...stapel.configs.recommended
);
