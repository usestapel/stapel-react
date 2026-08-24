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
    // The three widths the fleet actually designs for. `@stapel/tokens`'
    // breakpoints are phone < 768 <= tablet < 1024 <= desktop, and 390 is the
    // phone every mobile review starts from — so the viewer offers exactly
    // those, rather than Ladle's stock 414/640/768/1024, which has no 390 in
    // it and therefore cannot show the sheet-vs-modal switch at the width a
    // person actually reports.
    width: {
      enabled: true,
      options: { phone: 390, tablet: 768, desktop: 1280 },
      defaultState: 0,
    },
    rtl: { enabled: false },
    source: { enabled: true },
  },
};
