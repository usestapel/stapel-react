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
- **No more "your session expired" banner on a cold visit or after an
  explicit logout.** A refresh failure now settles two different ways
  depending on whether the session had ever left `"initializing"` BEFORE the
  attempt: genuinely established (`authenticated`/`anonymous`) → real
  teardown, `onTeardown`/`onSessionLost` fire (the host's banner policy).
  Still `"initializing"` (a cold visit, or the bootstrap probe finding
  nothing) → quiet `markUnauthenticated()`, no callback, no banner — there
  was nothing to lose. One function (`settleRefreshFailure`) now covers
  every path that can call `doRefresh` (the bootstrap probe AND a live 401
  retry), so the wrong banner has nowhere left to sneak back in from.

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
- **Passkey = direct trigger, never a modal** (owner UX audit): clicking
  "Add a passkey" in `PasskeysManager` now begins the WebAuthn ceremony
  immediately — no name-entry dialog, no `Modal` wrapper (the browser's own
  prompt IS the UI, matching the sign-in `PasskeyPanel`'s existing
  behavior). A device name is inferred from the user agent.
- **QR codes are now actually scannable.** `QrDeviceLinkPanel` and the
  sign-in `QrPanel` render at 240px (was 200px) with explicit black-on-white
  + a white quiet-zone padding, instead of antd's transparent default (which
  renders unscannable low-contrast over anything but a plain white page —
  the same bug already fixed once for the in-room QR modal in the meettoday
  host app). A new live scan-decodability test
  (`test/qrScannability.test.ts`) renders the same value/contrast/size with
  a spec-compliant encoder and decodes it with a real QR reader (`jsqr`),
  including a negative case proving low contrast fails to decode — not just
  "the props look right".
- **No more duplicate tab-label text** ("Email" tab + "Email" field label
  reading as "Email Email"): a main-tab channel with its own field label
  matching the tab (`OtpPanel`'s email/phone) now suppresses that label —
  the placeholder still carries the affordance. A lone main channel (no
  tab strip in view) keeps its label; only the overflow/bottom dialog and
  the multi-tab case differ.
- **Anonymous ("continue as guest") entry added to `AuthPanel`**: when the
  backend's `capabilities.registration.anonymous` is `true`, a fixed
  "Continue as guest" link now appears under the sign-in form
  (ironmemo-frontend placement parity) — previously there was no way to
  reach the existing headless `AnonymousSession` flow from the default
  skin at all. Deliberately NOT modeled as a `methods[]`-tracked channel
  (no placement/order/interaction) — a fixed skin element is enough for
  what every real deployment treats as a single, unconditional entry point.
