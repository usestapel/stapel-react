---
"@stapel/auth-react": minor
---

Add this pair's nav-manifest entries (`src/nav/manifest.ts`, `auth.login` and `auth.security`) for the scripted-fullstack navigation contract, and a new composed `<SecuritySettings/>` default-skin component (`@stapel/auth-react/default`) that stacks the six existing standalone security widgets (`SessionsList`, `TotpManager`, `PasskeysManager`, `PasswordChangePanel`, `OAuthLinks`, `QrDeviceLinkPanel`) into one page — the component the `auth.security` nav entry points at. Each widget stays individually exported for hosts that want them separately. Two new i18n keys (`auth.nav.login`, `auth.nav.security`, en + ru).
