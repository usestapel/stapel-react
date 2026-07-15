---
"@stapel/auth-react": patch
---

Re-publish `@stapel/auth-react` on the pre-1.0 `0.2.x` line (the npm-published
`1.0.0` was published in error and is deprecated — see its deprecation
notice). This release carries the actual HEAD API, which had drifted from
what was live on npm:

- `onSessionLost` — `createAuthRuntime({ onSessionLost })` /
  `createAuthSession({ onSessionLost })`, the host's involuntary-session-loss
  policy (login redirect vs anonymous auto-login), fired only for
  `revoked`/`expired`, never for explicit `logout()`.
- `authI18nBundleEn` — the English error/UI i18n bundle export, alongside the
  existing `/i18n/ru` subpath.
- The `@stapel/auth-react/default` themed `<AuthPanel/>` skin (§54).

Also fixes `peerDependencies["@stapel/core"]`, which on the published `1.0.0`
was pinned to `^0.2.0` against the actual current `@stapel/core` `0.4.x` —
consumers had to override peer resolution to install cleanly. HEAD's range
(`>=0.3.0 <1.0.0`) already covers `0.4.x`.
