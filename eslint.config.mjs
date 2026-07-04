// Root ESLint flat config for stapel-react.
// Packages run `eslint .` from their own directory; ESLint resolves this file
// by walking up, so the ruleset is shared without workspace-relative imports
// in package sources.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.css",
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
      // TODO(frontend-standard §4.2): enable a no-literal-strings rule for JSX
      // (user-facing strings must be i18n keys). Candidates:
      // eslint-plugin-i18next `no-literal-string` or a custom @stapel rule that
      // whitelists i18n keys and technical attributes. Placeholder until the
      // first L2 package lands.
      // TODO(frontend-standard §4.1): add a no-raw-colors rule (stylelint +
      // eslint) once styled surfaces exist; tokens-only enforcement.
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
  }
);
