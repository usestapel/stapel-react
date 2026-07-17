---
"@stapel/auth-react": minor
---

Owner UX audit of the default settings skins (2026-07-17) + a live P0 session
incident, fixed together:

**Session / cookie-mode canon (the P0 incident)**
- **`cookieMode` now defaults to `true`** in both `createAuthSession` and
  `createAuthRuntime` (was `false`). Cookie mode is the right default for a
  web app; header/bearer is a native/mobile concern (no shared cookie jar) —
  opt in explicitly with `cookieMode: false`.
- `createAuthRuntime`'s `credentials` default and the session's `cookieMode`
  used to each independently re-derive their own default from
  `options.cookieMode`, and disagreed — now resolved ONCE and shared, so
  `credentials: "include"` reliably rides cookie-mode requests.
- `restore()` now runs a **cookie-mode bootstrap probe**: when nothing
  authenticated was found locally, it attempts the cookie-backed refresh
  directly (not through `sessionManager.refresh()`, whose failure path
  assumes an existing session is ending) — discovers a session set entirely
  outside this JS runtime (e.g. a QR `session_share` scan's plain-redirect
  cookies) instead of settling "expired" without ever trying.
- `onAuthRefresh` now resolves `""` (not `null`) on a successful cookie-mode
  refresh — pairs with the `@stapel/core` client fix so a cookie-mode 401
  retry actually re-issues the request instead of throwing the original
  error (see that package's changeset).

**Settings-tab UX audit**
- `QrDeviceLinkPanel` ("sign in on another device") now opens its journey in
  a `Modal` (desktop) / bottom `Drawer` (phone) instead of revealing inline
  below the trigger row — matches every other security dialog
  (`TotpManager`/`PasskeysManager`).
- The QR flow gained `pollNow()` + a `visibilitychange` listener: a
  backgrounded tab (the exact moment a user turns to their phone to scan)
  throttles `setTimeout`-driven polling; the instant the tab is foregrounded
  again, status is re-checked immediately. An explicit "that code
  expired — getting you a new one…" caption now shows during an
  auto-regenerate (ironmemo-frontend reference semantics), instead of
  silently swapping the old code for an unexplained spinner.
- `PasswordChangePanel` gained a "confirm new password" field (both the
  old-password and OTP-verified tabs) with cross-field match validation.
- `SessionsList`/`PasskeysManager`/`OAuthLinks`'s empty states use a
  consistent, plain shield-outline glyph (`emptyIcon` prop to override)
  instead of antd's default cartoon "no data" illustration — out of place
  next to the `icon_svg` auth-contract's plain line-art aesthetic.
- Two developer-facing i18n strings fixed to read as user copy: OAuth
  link/unlink-unavailable hints no longer mention `getAccessToken` or
  "this backend has no unlink endpoint".
