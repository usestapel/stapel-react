// Ladle config for the workspace design-system showcase (frontend-guardrails
// §4.1). Ladle is a commodity VIEWER; the source format is ours (defineDemo).
// It renders the CSF stories gen:demos projects into each package's
// demo/generated — never hand-authored stories, so the viewer can't drift from
// the components. Regenerate stories with `pnpm gen:demos` at the repo root.
/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: "../*/demo/generated/*.stories.tsx",
  defaultStory: "auth-react--passwordless-login-otp",
  addons: {
    // The theme toggle drives data-theme on <html> (see .ladle/components.tsx),
    // which is how @stapel/tokens switches light/dark (§1.1).
    theme: { enabled: true, defaultState: "light" },
    width: { enabled: true },
    rtl: { enabled: false },
    source: { enabled: true },
  },
};
