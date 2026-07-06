// Stylelint preset (frontend-guardrails §2.2). Drop into a host's
// stylelint.config.js:
//
//   import stapelPreset from "@stapel/eslint-plugin/stylelint/preset";
//   export default { ...stapelPreset };
//
// Enables the self-contained colour-tokens-only rule (no hex/rgb/hsl in CSS;
// colour properties only via var(--stapel-*)).
export default {
  plugins: ["@stapel/eslint-plugin/stylelint"],
  rules: {
    "stapel/color-tokens-only": true,
  },
};
