// Root stylelint config — the CSS half of the frontend guardrails
// (frontend-guardrails §2.2): colours in .css only as var(--stapel-*) tokens,
// no hex/rgb()/hsl() literals. The rule itself ships with
// @stapel/eslint-plugin (self-contained plugin, `stylelint/preset`), so hosts
// and the scaffold wire the exact same preset.
import preset from "@stapel/eslint-plugin/stylelint/preset";

export default {
  ...preset,
  ignoreFiles: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    // Generated token emissions are where hex is BORN (gen:tokens §1.1) —
    // tokens.css/tailwind.css inline ramp values by design, drift-gated.
    "**/generated/**",
    // Tests/fixtures legitimately exercise the anti-patterns (same policy as
    // the eslint preset's TEST_FILES scope-off).
    "**/test/**",
    "**/tests/**",
    "**/fixtures/**",
  ],
};
