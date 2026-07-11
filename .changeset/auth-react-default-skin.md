---
"@stapel/auth-react": minor
---

Add the **§54 pilot default skin** behind a new `@stapel/auth-react/default`
subpath: `<AuthPanel/>` — the pair's existing headless layer (flows +
`useCapabilities`) rendered with an Ant Design skin whose theme comes
AUTOMATICALLY from the user's `@stapel/tokens` via `@stapel/tokens-antd`. Import
it and you have a working, themed sign-in screen; zero hand-written UI.

- Follows domain-guidelines-auth: four zones A-D in fixed order, channels
  discovered from the backend and sorted by the ratified priority, cut into ≤3
  primary tabs + ≤2 secondary buttons + a "More" overflow, exactly one primary
  button, inline errors at the source (`t(code, params)`), OTP via `Input.OTP`
  with a per-flow resend cooldown, inline TOTP step-up, and an inline QR panel
  (never a modal).
- Separate entry point so apps that build their own visuals never pull `antd`
  into their bundle — the main `index.js` stays antd-free (size-gate holds at
  11.25 kB < 12 kB). `antd` and `@stapel/tokens-antd` are OPTIONAL peer
  dependencies; only `/default` needs them.
- Pure channel-discovery/zone-splitting helpers (`enabledChannels`,
  `splitZones`, `DEFAULT_CHANNEL_PRIORITY`) are exported and unit-tested; a
  render test proves `<AuthPanel/>` mounts a themed screen and that
  `toAntdThemeConfig` flips antd's runtime token to the tokens' light/dark
  container colour. Adds the `auth.ui.*` UI keys (en + ru).
