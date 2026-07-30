---
"@stapel/auth-react": patch
---

The /default skin can be imported by Node, not only by a bundler.

Found while auditing why the passkey fix (0.12.1) still looked absent in a
host: `meettoday`'s frontend could not write a single test that renders a real
`@stapel/auth-react/default` component. Importing the barrel under plain Node
ESM threw `ERR_MODULE_NOT_FOUND` on `dist/default/OtpField`.

Four emitted modules — `default/panels.js`, `default/FirstLoginPanels.js`,
`default/security/PasswordChangePanel.js`,
`default/security/AuthenticatorChangePanel.js` — imported `"./OtpField"`
without the `.js` extension. Every package here is `"type": "module"` and tsc
copies relative specifiers verbatim, so the extension a Node ESM resolver
requires was simply never there. A bundler (Vite/webpack) guesses the
extension, which is why `vite build` and every browser were fine and nothing
in CI noticed: the package's own tests import from `src/`, never from the
emitted specifier. What broke was every consumer that loads the package under
plain Node — vitest with the dependency externalized (the default), SSR, a
node script. Present since 0.11.0, when `OtpField` was extracted.

The extensions are added, and the shape is now mechanically closed rather than
remembered: an ESLint `no-restricted-syntax` pair rejects any relative
import/re-export without an explicit extension, repo-wide.

No API change; `.mjs`/`.cjs`/asset specifiers are unaffected.
