# @stapel/auth-react

## 0.8.0

### Minor Changes

- c56ec88: Registration surface — identity model, now configurable.

  - `<AuthPanel variant="register"/>` renders ONLY verified identity anchors by default — email/phone/oauth/sso. Password is a credential, not an anchor: setting one does not create an identity (it only makes a guest account portable), so it no longer appears on the "create an account" screen even if the backend sends `can_register: true` for it. Fixes the wrong-model behaviour where password leaked onto the register surface.
  - New configurable seam: `enabledRegistrationChannels(methods, priority, anchors)` takes an anchor set, and `<AuthPanel>` gains a `registrationAnchors` prop (defaulting to the exported `REGISTRATION_ANCHORS`). A deployment that deliberately wants classic login/password accounts ("90s-style" — password IS the account and deanonymizes) opts password in via this prop, wired from its app env, paired with the backend's new `AUTH_PASSWORD_DEANONYMIZES=True`. `REGISTRATION_ANCHORS` is now exported from `@stapel/auth-react/default`.
  - Regenerated the error i18n bundle from the current stapel-auth contract (adds `totp_proof_required`, `totp_not_enabled` and other keys the committed bundle had drifted behind).

## 0.7.0

### Minor Changes

- 2a7dd6f: TOTP change UI for stapel-auth's ≥0.9.0 TOTP-change surface (`/totp/setup/` proof-gated replace + `/totp/change/delayed/*` removal) — the API client was regenerated against the new backend schema first (`pnpm gen:api`/`gen:errors`/`gen:manifest`), then the UI built against the resulting generated types.

  - **`TotpSetup` headless flow / `TotpSetupBag.start()`** now accepts an optional `{ code?, backup_code? }` proof. Replacing an already-active device without proof surfaces the backend's 400 `totp_proof_required` as a new `"proofRequired"` step (rather than the generic `"startError"`) — `error` on that step is only set once a _supplied_ proof was rejected, so the first, un-proved attempt doesn't flash a spurious error.
  - **New delayed-removal ("lost device") surface**: `useTotpDelayedChangeStatus` (query), `useInitiateTotpDelayedChange`/`useCancelTotpDelayedChange` (mutations) — plain CRUD hooks mirroring the existing email/phone `useDelayedChangeStatus`/`useInitiateDelayedChange`/`useCancelDelayedChange`, reusing the SAME `DelayedChangeInitiatedResponse`/`DelayedChangeStatus` response shapes (the backend runs the identical `AuthenticatorChangeRequest` machine — 14-day cooldown, day-1/7/13 notifications, cancel window — just ending in a TOTP disable instead of a contact swap).
  - **`<TotpManager/>`** (default skin) now offers, when a device is active: a **Replace** action that opens straight on a proof-collection form (never fires a proof-less request the backend would just 400 on) and, from there, a **"Lost your authenticator?"** link into the delayed-removal flow — mirroring `AuthenticatorChangePanel`'s instant/delayed split and its "no access to old {channel}?" placement. A pending delayed removal short-circuits the whole card to a pending banner (scheduled date, days remaining, cancel) on mount, same rule `AuthenticatorChangePanel` already follows. `no_verified_contact` on initiate renders a dead-end `Result` (contact support), not another retry of the same form.
  - New i18n keys (en + ru) for all of the above; no new headless component (the new UI reuses the existing `TotpSetup` headless export, now with a wider `start()` signature), so no new demo was needed — `gen:demos`'s completeness gate already passes.
  - `dist/index.js`/`dist/i18n/ru.js` size-limit budgets bumped (15 KB→15.5 KB, 9.5 KB→10 KB) for the added surface.

- cff85d2: `useMe` is now cache-first / stale-while-revalidate: `staleTime: 0` makes it unconditionally revalidate on every mount via TanStack Query's default `refetchOnMount`, regardless of how fresh a hydrated `/me` snapshot looks. Pair it with `@stapel/core`'s new `createMeCachePersister` — wire `<StapelProvider meCacheQueryKeys={[authQueryKeys.me()]}>` — and a cold load paints the last-known user instantly from `localStorage`, then updates once the network responds. No wiring, no persister: behavior is unchanged (a normal fetch-on-mount query).

## 0.6.0

### Minor Changes

- 8caba53: Owner-diagnosed live incident (meettoday migrators, composes with the bearer-mode `bootstrapProbe` fix): `AuthSession` could settle into `{ status: "authenticated", user: null }` — an inconsistent state this library neither prevented nor documented. Path: bearer mode, only a QR-minted httponly cookie present. Cold load → `restore()` finds nothing locally → `bootstrapProbe()` → `sessionManager.refresh()` → `doRefresh()` → `setTokens()`, which spread the (still-null) prior `state.user` and hand-set `status: "authenticated"` regardless — only `adopt()` ever set `user`. A `ProtectedRoute` that correctly checks BOTH `status` and `user` (`!isAuthenticated || !user`) saw a contradiction and bounced a signed-in user back to login on every navigation.

  Two layers, both shipped (documentation alone was explicitly not acceptable — the fix makes the illegal state unrepresentable):

  - **`status` is now DERIVED, never hand-set.** Every state transition computes `status` from `user`/`tokens` via one internal `computeStatus()` — `{ status: "authenticated", user: null }` cannot be constructed through this module's public surface anymore, from any call site (this also closes the same shape of bug in `setTokens()`'s OTHER caller, `QrLogin.tsx`'s `login_request` fulfilment, which is token-only too).
  - **`setTokens()` resolves the user before settling authenticated.** stapel-auth's `GET/POST /token/refresh/` returns tokens only (`TokenPairResponse`/`RefreshResponse` — access+refresh, never a user), so a bare token pair with no already-known user now calls `me()` (via the seam-free refresh client — safe to call from inside a refresh, no reentrancy) and only marks the session authenticated once a user comes back. If that resolution fails (dead tokens, network error), the tokens are cleared and the session settles unauthenticated instead of leaving a dangling, unconfirmed "authenticated" session — this never throws.
  - `createAuthRuntime`'s dedicated refresh-only client now also carries a `getToken` (sourced from the session's own state) so this in-flight `me()` call authenticates correctly in bearer mode without reintroducing the `onAuthRefresh`-seam reentrancy the refresh-only client exists to avoid.
  - `doRefresh`'s return value to core's `SessionManager` is now read back from what `setTokens()` actually settled, instead of a hardcoded `"authenticated"` — this also fixes a latent inconsistency where a guest (`is_anonymous`) token refresh would flip the core `SessionManager` back to `"authenticated"` a moment after `setTokens()` correctly called `markAnonymous()`.

  See the README's new "The `status`/`user` invariant" section for the contract and a `ProtectedRoute` example.

- 3747681: Consumer-reported gap (meettoday migrators, real production incident): `bootstrapProbe()` silently no-op'd in bearer mode (`cookieMode: false`) whenever nothing was persisted locally — exactly the shape of a `session_share` QR scan, magic-link click, SSO, or OAuth callback, all of which mint fresh httponly JWT cookies via a plain HTTP redirect entirely outside this runtime. A bearer-mode host cold-loading afterwards had a perfectly valid server-side session and no way to discover it — it just looked logged out.

  - **New runtime option `bootstrapProbe?: "auto" | "always" | "off"`** (`createAuthRuntime` and `createAuthSession`), default `"auto"`:
    - `"auto"` probes bearer mode when the non-httponly `stapel_auth_hint` cookie is present (a plain `document.cookie` check, SSR-safe) — this cookie is set by `stapel-auth ^0.7.6` alongside every httponly refresh cookie it mints, so a bearer host pays **zero** extra network calls on a cold load that never touched a cookie-minting flow (verified via a mock-fetch call-count assertion).
    - `"always"` probes bearer mode unconditionally, for backends that don't set the hint.
    - `"off"` reproduces the old silent bearer behavior, but now logs a one-time `console.warn` so this coverage gap can't recur invisibly.
    - Cookie mode (`cookieMode: true`) is unaffected — it already probed unconditionally and still does.
  - A successful bearer-mode probe adopts the discovered session through the exact same `setTokens()` path a normal refresh uses — no separate bearer-mode adoption code, no new persistence (bearer mode still never writes tokens to storage).
  - The refresh-only client built by `createAuthRuntime` now defaults its `credentials` to `"include"` **regardless of `cookieMode`** (previously bearer mode left it at the browser default, which silently drops cross-origin cookies) — this is what lets the probe's refresh call actually see the cookie jar. The main client's `credentials` default is unchanged (still `cookieMode`-gated). An explicit `credentials` option still overrides both clients identically.
  - A genuine network/transport failure during any refresh attempt (not a clean 401) now logs a `console.warn` before settling anonymous — previously indistinguishable from "there was never a session".
  - Fixed the `bootstrapProbe()`/`cookieMode` doc comments, which read as describing a cookie-mode-only mechanism and were the direct cause of a consumer removing their own workaround under the mistaken impression this was already a general fix.

  See the package README's new "The bootstrap probe & `bootstrapProbe`" section for the full contract and an example.

- 99c93fd: THE IDENTITY MODEL, end to end on the frontend (pairs with stapel-auth 0.8.0's promote-not-orphan backend fix): an account is REGISTERED iff it carries a verified identity anchor (email, phone, or a federated identity) — credentials (password/passkey/TOTP) never promote on their own.

  - **New registration surface**: `<AuthPanel variant="register"/>` (a new `variant` prop, distinct from the light/dark `mode` prop) renders only channels whose backend `methods[].can_register===true` (stapel-auth ≥0.7.0) — never passkey/qr/magic_link, which have no registration axis. The `password` channel renders a new `PasswordRegisterPanel` (email optional + password + confirm — a SET-password form calling the new `passwordRegister` API/`createPasswordRegisterFlow`/`<PasswordRegister>` headless component), not the login `PasswordPanel`. The guest-entry link is login-surface only.
  - **Per-method capability labels**: `channels.ts` gains `enabledRegistrationChannels()` and `methodCapabilityLabel(id, methods, isAnonymous)` — "For sign-in" / "For registration" / "Sign-in and registration", derived from the new `AuthMethodInfo.can_login`/`.can_register` fields. `PasswordChangePanel` now shows this caption for the `password` method, with a special case: an ANONYMOUS viewer sees "Sign in to your guest account from another device" instead of the generic label — password never means "registered" for them, only portable.
  - **`session.adopt()` on promotion**: `password/change/otp/verify/`'s response is now a union (`PasswordOtpChangeResponse` = `AuthResponse | StatusResponse`, narrowed by the new `isAuthResponse()`); `passwordChangeFlow.ts`'s `submitOtp` calls the new `onAuthenticated` dep only when the response is a real `AuthResponse` (i.e. the backend promoted an anonymous caller), so `session.adopt()` fires and flips anon→registered. `passwordRegisterFlow.ts`/`<PasswordRegister>` always adopt, since `register()` always returns a full `AuthResponse`.
  - New i18n keys (en + ru): `uiRegisterTitle`/`uiRegisterConfirmLabel`/`uiRegisterMismatch`/`uiRegisterSubmit`, `secMethodCapLogin`/`secMethodCapRegister`/`secMethodCapBoth`/`secMethodCapPortableAnon`.
  - Generated `api/generated/schema.ts` regenerated from stapel-auth's updated `docs/schema.json` (adds `AuthMethodInfo.can_login`/`.can_register`, the `sso` `AuthTypeEnum` member, `PasswordOtpChangeResponse`).

- fdaf339: Add this pair's nav-manifest entries (`src/nav/manifest.ts`, `auth.login` and `auth.security`) for the scripted-fullstack navigation contract, and a new composed `<SecuritySettings/>` default-skin component (`@stapel/auth-react/default`) that stacks the six existing standalone security widgets (`SessionsList`, `TotpManager`, `PasskeysManager`, `PasswordChangePanel`, `OAuthLinks`, `QrDeviceLinkPanel`) into one page — the component the `auth.security` nav entry points at. Each widget stays individually exported for hosts that want them separately. Two new i18n keys (`auth.nav.login`, `auth.nav.security`, en + ru).
- 303abb6: `SecuritySettings` was six widgets stacked in one `<Card>` with `<Divider>`s — no page title, no per-section structure, each widget's own heading a bare `Typography.Title` that vanished if a host ever mounted a widget outside that composed page (the exact failure mode a downstream consumer hit). Rebuilt as a real settings page:

  - Every `default/security/*` widget (`SessionsList`, `TotpManager`, `PasskeysManager`, `PasswordChangePanel`, `OAuthLinks`, `QrDeviceLinkPanel`) now self-wraps in its **own `<Card title=…>`** — the section heading moved into the Card title, so each widget reads as a distinct settings section even mounted bare, not just inside `SecuritySettings`.
  - **New `EmailChangePanel`/`PhoneChangePanel`** (default-skin, `default/security/`), both thin `channel`-parametrized wrappers around a new shared `AuthenticatorChangePanel` — built entirely on the EXISTING `<AuthenticatorChange>` headless flow (instant: request-old → verify-old → request-new → verify-new) and the existing `useDelayedChangeStatus`/`useCancelDelayedChange` hooks, no flow rebuilt. Shows the masked current email/phone, a primary "Change email/phone" action (instant, default), and a secondary "No access to your old email/phone?" path into the delayed (14-day) strategy via the new `useInitiateDelayedChange` mutation. A pending delayed change — on mount, or freshly started — short-circuits straight to a pending-status banner ("Changing to … in N days", with a cancel action) instead of the change form.
  - **New `AuditLogPanel`** (default-skin) — re-adds the security audit log UI dropped during the ironmemo port, over the existing `useAuditLog` query: an antd `List` with loading/empty/error states and "Load more" pagination.
  - `SecuritySettings` is now `Typography.Title level={2}` "Security" + a subtitle, then the widgets in grouped, titled sections: Contact details (email/phone change) → Password → Two-factor authentication (TOTP, passkeys) → Devices & sessions (sessions, QR device link) → Connected accounts (OAuth) → Security log (audit).
  - New i18n keys (en + ru) for all of the above; `EmailChangePanel`/`PhoneChangePanel`/`AuditLogPanel`/`AuthenticatorChangePanel` exported from `@stapel/auth-react/default`; `useInitiateDelayedChange` now exported from the main entry (it existed on the API client already — `changeDelayedInitiate` — just had no query hook wired to it).
  - `size-limit` budgets bumped (14 KB → 15 KB main entry, 8.5 KB → 9.5 KB `i18n/ru`) to fit the new keys; both stay well under their new ceilings.

  TOTP "change" (as opposed to enable/disable) stays out of scope — it needs a new backend endpoint, tracked separately.

## 0.5.2

### Patch Changes

- c20f56f: Bumps the `stapel-auth` contract pin (`contract-pins.json`) from v0.6.0 to v0.7.5 and regenerates `api/generated/schema.ts`, `i18n/generated/errors.*`, `manifest.json`, and `llms.txt` against it. This removes the orphaned `totp_step_up` operation/types/error (`TOTPStepUp`, `TOTPStepUpResponse`, `error.403.step_up_required`) that had drifted into the generated output from a locally-ahead checkout — the backend's v0.7.0 release scrubbed the legacy `X-Step-Up-Token` surface entirely (superseded by the unified `/verification/` step-up flow), and this regen catches auth-react's generated contract up to that removal. Also picks up v0.7.1-0.7.5's additive changes: QR `generate` now echoes back the accepted `redirect_url`/`allow_unauthenticated_scanner`, and capabilities/login-config gain `mock`/`email_mock`/`phone_mock` flags for mocked OTP delivery.
- c20f56f: Fixes a live-incident race (owner-diagnosed finisher, миттудей): `AuthSession.logout()` used to await the server-side revoke call BEFORE any local teardown. In the window between the server honoring that revoke and this session getting back around to tearing itself down, a parallel authenticated request (e.g. a Navbar still holding a stale `useWorkspaces` query) would 401, retry its own refresh against the now-revoked token, fail, and race a `sessionLost('expired'/'revoked')` teardown in ahead of the explicit logout — rendering a "session expired" banner on a logout the user asked for themselves.

  Two changes, combined:

  - `@stapel/core`'s `SessionManager.logout()` now holds a `loggingOut` guard for its full duration (set synchronously before its first `await`). `sessionLost()` is a no-op while that guard is up — in addition to its existing idempotent no-op once already `"unauthenticated"` — and now reports which case applies via its return value (`Promise<boolean>`: `true` only if it actually performed a teardown).
  - `@stapel/auth-react`'s `AuthSession.logout()` now runs the local teardown (`sessionManager.logout()` + `onTeardown('logout')`) FIRST — instant, no network dependency — and treats the server revoke as best-effort afterward. `settleRefreshFailure` only calls `onTeardown(reason)` when `sessionLost()` reports it actually tore the session down, so a racing refresh failure during an in-flight logout never fires a contradictory `onTeardown('expired'|'revoked')`.

## 0.5.1

### Patch Changes

- 784cb9f: Removes four orphaned i18n keys (`secPasskeysAddTitle`/`secPasskeysNameLabel`/`secPasskeysNamePlaceholder`/`secPasskeysBeginCta`) left over from a passkey-registration modal that no longer exists in `<PasskeysManager/>` — dead keys with no reader, in both the `en` bundle (`i18n/keys.ts`) and the `ru` bundle (`i18n/ru.ts`).

## 0.5.0

### Minor Changes

- 6ef6c44: Owner UX audit of the default settings skins (2026-07-17) + a live P0 session
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
    - a white quiet-zone padding, instead of antd's transparent default (which
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

## 0.4.0

### Minor Changes

- 6ecee8b: Adds `<QrDeviceLinkPanel/>` (`@stapel/auth-react/default`) — a default-skin `session_share` QR device-handoff panel: a logged-in device generates a QR immediately on trigger (no extra "generate" click), shows a live TTL countdown, silently auto-refreshes on a backend-reported `expired`, and surfaces `fulfilled`/`rejected`/error status with retry. Built entirely on the pair's existing `QrLogin` headless flow (`qrGenerate`/`qrStatus`/`qrReject`) — no new backend surface. `allowUnauthenticatedScanner` defaults to `true` (stapel-auth 403s an unauthenticated `session_share` scan unless this is set, since the whole point of this component is an unauthenticated phone scanning to sign in). Generic by design, not settings-bound: title/subtitle/`redirectUrl` are props so a host can place it on e.g. a live call/meeting page (its primary intended use — "continue this on your phone") as well as a security-settings "add a device" card, where it ships alongside `SessionsList`/`TotpManager`/`PasskeysManager`/`OAuthLinks`.

  The underlying `createQrLoginFlow`/`QrLogin` headless layer gains a `cancel()` action alongside the existing `dispose()`: `dispose()` keeps its current client-only stop behavior (no server call — existing callers like the sign-in `QrPanel` are unaffected), while `cancel()` best-effort calls the existing `/qr/{key}/reject/` endpoint before disposing, so a user-initiated cancel actually invalidates the pending key server-side instead of just going quiet locally.

  `i18n/ru` size-limit budget raised 8kB→8.5kB for the new copy.

## 0.3.0

### Minor Changes

- 569d7b2: Contract pin bumped to stapel-auth 0.6.0: `capabilities()` is now a fully generated response (`AuthCapabilities`) instead of hand-transcribed — it gains `methods` (per-method `placement`/`order`/`interaction`/`icon_svg`) and `otp` (server-authoritative `email_code_length`/`phone_code_length`/`totp_code_length`/`ttl_seconds`/`resend_cooldown_seconds`). The `/oauth/links/` list/link/unlink trio also ships in this contract.

  Default-skin tuning (owner directive): alt sign-in methods picked from the bottom icon row or the "More ways to sign in" overflow menu now open in a dialog (Modal on tablet/desktop, a bottom Drawer "sheet" on phone via `@stapel/core`'s `useBreakpoint`) — fixing a bug where an overflow pick set `active` to a channel absent from the tab strip's own `items`, so nothing rendered. Main tabs are capped at 3 and never grow from an overflow/bottom pick. SSO and OAuth are never a tab (SSO gets a real domain-lookup dialog; OAuth renders as direct per-provider redirect buttons). Channel `placement`/`interaction`/`icon_svg` come from the backend's `capabilities().methods` via `computeZones`/`resolveInteraction`/`methodIconSvg`; a channel `methods[]` is silent on falls back to a per-channel default (email/phone → main, password/magic_link → overflow, sso/oauth/qr/passkey → bottom — stapel-auth's own defaults). "Magic link" is renamed "Email link" (ru: "Ссылка на почту").

  BREAKING (alpha-canon, owner directive): the old backend compatibility mode is removed. `computeZones` no longer falls back to a fixed placement table when the backend omits `methods[]` entirely — there is no supported pre-0.6.0 backend to fall back for (every real deployment is kept upgraded to the latest stapel-auth). A missing/empty `methods[]` on a non-empty channel list now throws loudly (`"backend older than stapel-auth 0.6.0 is not supported"`) instead of silently reproducing a layout the backend never asked for. The email/phone OTP step now auto-submits once every `Input.OTP` cell is filled (no "Confirm" button) — digit count from `capabilities().otp` (fallback 6) — and clears + refocuses on a wrong code; the same server-authoritative length now backs `TotpManager`'s and `PasswordChangePanel`'s OTP inputs too.

  Ships the pair's first security-settings default-skin components (`@stapel/auth-react/default`): `SessionsList`, `TotpManager`, `PasskeysManager`, `PasswordChangePanel`, `OAuthLinks`. `OAuthLinks` (`useOAuthLinks`/`useLinkOAuth`/`useUnlinkOAuth`) is real end to end for read + unlink; its "Connect" action and `PasskeysManager`'s "Add" both take a thin host binding (`getAccessToken`/`webauthnCreate`) for the browser-side ceremony this pair cannot perform itself, same boundary as the existing WebAuthn TODO.

  Adds `usePhoneCountryDefault` (in `model/`, not `headless/` — it's a plain hook) — an opt-in (default OFF) IP→country phone-prefix hook; not wired into `AuthPanel` automatically.

  `size-limit` budgets raised (12kB→13.5kB main, 7kB→8kB ru locale) for the new UI copy.

## 0.2.3

### Patch Changes

- ae57230: v1 canon sweep §60 (api-versioning.md §2, §6): regenerated schema.ts /
  flows / manifest / llms.txt against the backends' `/…/api/v1/` contracts;
  gen scripts and manifest tag prefixes repointed to `/api/v1/`; documented
  `baseUrl` examples and the auth QR same-origin guard now use
  `/<mod>/api/v1/`. Public TS types unchanged — only the fetch base / path
  literals carry the new version segment. Mount your runtimes at
  `/<mod>/api/v1/`.

## 0.2.2

### Patch Changes

- b7646cb: Document the already-optional `antd` / `@stapel/tokens-antd` peer dependencies
  in the README: the headless core (flows, `AuthProvider`, `createAuthRuntime`)
  has zero UI dependency and works under any renderer on React `>=19` (MUI,
  Chakra, plain HTML); only `@stapel/auth-react/default` (the §54 AntD skin)
  needs `antd`/`@stapel/tokens-antd`, and `npm install` won't require or warn
  about them otherwise.

  Verified by fact-check (frontend-core-architecture-v2 §54 audit): `antd` and
  `@stapel/tokens-antd` imports are confined to `src/default/*`; the main entry
  never imports from `./default`. No React-19-only APIs (`use()`,
  `useOptimistic`, `useFormStatus`, `useActionState`) are used anywhere in the
  package — the `react: ">=19"` floor is a deliberate policy choice, not an API
  constraint, so it is left unchanged. Confirmed with a `pnpm pack`'d tarball
  smoke test: a minimal Vite + React 19 app with `@stapel/core` +
  `@stapel/auth-react` installed and NO `antd` in `node_modules` builds and
  initializes `createAuthRuntime()` cleanly.

## 0.2.1

### Patch Changes

- 1ef690c: Re-publish `@stapel/auth-react` on the pre-1.0 `0.2.x` line (the npm-published
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

## 1.0.0

### Minor Changes

- 48188d9: Add the **§54 pilot default skin** behind a new `@stapel/auth-react/default`
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

- 9ed6a4b: `createAuthSession` now builds on `@stapel/core`'s `createSessionManager`
  (frontend-core-architecture-v2 §43): auth keeps owning the tokens and the
  refresh HTTP call; the core SessionManager owns the lifecycle — single-flight
  refresh, status, events, the logout-hook registry, and the per-session
  encryption key.

  - New: `AuthSession.getSessionManager()` — other modules register logout
    hooks / read three-state status (guest sessions map from
    `user.is_anonymous` → `"anonymous"`) without depending on auth-react.
  - New: `createAuthRuntime({ onSessionLost })` / `createAuthSession({
onSessionLost })` — the host's involuntary-loss policy (login redirect vs
    anonymous auto-login, resolved from the host's discovery config). Fires
    only for `revoked`/`expired`, never for explicit `logout()`; `onTeardown`
    keeps firing for all three.
  - New: `createAuthSession({ refreshApi })` — the token-refresh call now rides
    a dedicated client WITHOUT the `onAuthRefresh` seam (wired automatically by
    `createAuthRuntime`), replacing the old in-module recursion flag.
  - `logout()` now fans out through the core logout-hook registry; auth-react's
    own state/persisted-storage cleanup is registered as a hook like everyone
    else's, and hooks also run on involuntary session loss.
  - Removed duplicate state: single-flight/dedup bookkeeping now lives only in
    core. Public API and existing behavior (teardown reasons, cookie mode,
    persistence shape) are unchanged.

### Patch Changes

- 2fa025a: §17 arch-contract-pipeline Wave 2 + Wave 3 — the five original pairs are now
  self-contained per-module contracts, aligned to their backend minor.

  **Wave 2 (contract isolation).** Each pair generates its typed surface from its
  backend module's OWN committed `docs/{schema,flows}.json` (byte-identical to the
  former monolith slice) instead of the unified monolith aggregate:

  - `gen:api` emits a package-LOCAL `src/api/generated/schema.ts` per pair (via the
    `API_SCHEMA`/`API_OUT` knobs — the calendar/recordings §17-native shape);
    `api/types.ts` aliases `components` from `./generated/schema.js`, no longer from
    `@stapel/core`. `@stapel/core` stays a RUNTIME peer (client / react-query),
    not the type source.
  - `gen:flows` reads `../stapel-<mod>/docs/flows.json`; `gen:manifest` reads the
    per-module `docs/schema.json`. Public types are unchanged — the repoint is a
    zero-diff source-swap (byte-identity proven), so no consumer breaks.

  **Wave 3 (version scheme B).** Each pair's minor now tracks its backend minor:
  `auth-react → 0.5.0` (stapel-auth 0.5.x), `notifications-react → 0.3.0`,
  `profiles-react → 0.3.0`, `billing-react → 0.4.0`, `workspaces-react → 0.3.0`.
  `manifest.backend.contract` records the one-minor compatibility window
  (`>=0.5 <0.6` etc.), auto-derived from the backend `pyproject.toml`.

- c3482e7: README wave (slim wave §21/S4): every pair now documents its setup — a new
  Install + "Wire the app once" section built on core's `<StapelProvider>`
  (previously only auth-react's README showed any wiring, as a 5-level provider
  nest). auth-react's wiring example moves to the one-provider shape with the
  `queryRuntime`/`i18n` escape hatches spelled out.
- Updated dependencies [48188d9]
  - @stapel/tokens-antd@0.2.0

## 0.2.0

Version reset: this release was previously tagged `1.0.0`/`1.1.0` in error. The
ecosystem is pre-1.0 (semver convention here: minor = breaking) and every other
pair sits at 0.x; auth-react's 1.x came from an unadjusted `npm init` default on
the hand-built etalon, before the scaffold (which correctly emits `0.0.0`)
existed. The erroneous pre-contract `1.0.0` was unpublished from npm (<72h
window) and never had a real release under that number. The entries below are
the unified, renumbered history of both former sections — no changes were
added, removed, or altered.

### Minor Changes

- 9289a17: Russian locale as an opt-in `@stapel/auth-react/i18n/ru` subpath (i18n-shipping
  wave 1 — the reference pattern for every pair).

  - `errors.ru.gen.ts` — generated per-locale error bundle: `gen-errors.mjs` now
    reads the backend's locale catalogs (`translations/errors.<lang>.json` beside
    the canonical `docs/errors.json`; auto-discovered, or pinned via
    `ERRORS_LOCALES` / `ERRORS_CATALOG_DIR`). The generator fails on a missing
    registry code or a broken `{param}` slot, and `pnpm gen:errors:check` remains
    the drift gate. Existing en outputs are byte-identical.
  - `@stapel/auth-react/i18n/ru` — `authI18nBundleRu` (generated backend ru +
    hand-written ru UI copy) and `registerAuthI18nRu(engine)`, which registers
    the en floor UNDER the ru texts so a missing key degrades to English, never
    to a raw key. Host bundles registered after the pair's win (merge-priority
    convention, now documented on `registerAuthI18n`).
  - Tree-shake purity is gated twice: the main-entry size-limit budget is
    unchanged (10.63 kB — the ru locale is not in its graph; the ru subpath is
    its own 5.62 kB chunk, budget 7 kB) and `test/i18nRu.test.ts` walks the
    compiled `dist/index.js` module graph asserting the ru modules never appear.

- 4a024a8: Self-describing SDK surface + generated backend-error map (frontend-core
  -architecture §2.4, §2.5, §4c) — closes failure mode F8 (an agent no longer
  guesses the package's surface from training priors).

  - **`manifest.json` + `llms.txt`** (new `./manifest` and `./llms.txt` exports,
    in the tarball, drift-gated). Generated by `scripts/gen-manifest.mjs` from the
    same codegen artifacts as the code — the operation catalog (schema.json), the
    documented flows (flows.json), the error map, the i18n keys, and the package
    exports. `manifest.json` is the machine-readable catalog; `llms.txt` is a
    ≤4k-token prose surface slice a harness drops into a coder's context instead
    of reading 11.8k lines of `schema.ts`.
  - **Generated error map** `errors.map` surface (`AUTH_ERRORS`,
    `AUTH_ERROR_CODES`, `authErrorBundleEn`, `explainAuthError`, `Remediation`).
    `scripts/gen-errors.mjs` reads the stapel-auth + stapel-core verification error
    registries and emits `code → { status, params, remediation, en }`. The English
    fallback bundle is spread into `authI18nBundleEn`, so **every** backend
    `error.*` key now has an en fallback — the 43 uncovered keys the pair review
    flagged (qr\_\*, oauth_failed, email_taken, refresh_invalid, …) no longer render
    as raw keys. A `gen:errors:check` drift gate + an `errorsBundle` test keep new
    backend keys from slipping through silently. `remediation` is a provisional
    heuristic until the backend declares it (task `error-remediation`).
  - **`scripts/gen-flows.mjs` parametrized by module** (`FLOW_MODULE`/`FLOW_OUT`/
    `FLOW_REGISTRY`/`FLOW_TYPE_PREFIX`) and now filters `flows.json` to the
    module's own flows, so a second module annotating `@flow_step` can't leak its
    flows into this pair's registry (and redden its drift gate on a foreign
    change). Auth output is unchanged bar a JSDoc reflow.

  Size budget raised 10→12 KB for the added en fallback bundle (matches the
  `@stapel/core` budget).

- 4a024a8: Flow-machine primitive moved into `@stapel/core` (frontend-core-architecture §4b).

  `createFlowMachine`, `useFlow`, and the `FlowError` helpers (`toFlowError`,
  `isErrorCode`) now live in `@stapel/core` — the single reviewed implementation
  every `@stapel/<module>-react` pair builds on, instead of each pair copying the
  primitive and forking its staleness/re-entrancy fixes. The primitive's tests
  travel with it. `@stapel/core.toFlowError(error, fallbackCode?)` takes an
  optional module-scoped fallback (default `stapel.error.unknown`).

  `@stapel/auth-react` now imports the primitive from core and **re-exports** it
  (`createFlowMachine`, `useFlow`, `FlowMachine`, `FlowError`, …) for one minor so
  existing imports keep resolving; its `toFlowError` wrapper pins the
  `auth.error.unknown` fallback. No behavior change — the machine implementation
  is byte-for-byte the reviewed one.

- 43e9624: `gen:errors` now consumes the backend's canonical `errors.json` artifact
  instead of parsing Python sources (frontend-core-architecture §2.5; backend
  task `error-remediation`).

  **Driver migration.** `scripts/gen-errors.mjs` reads
  `stapel-auth/docs/errors.json` — a byte-stable, code-sorted array of
  `{ code, status, params, remediation, en }` emitted by the backend alongside
  `schema.json`/`flows.json` (path override: `AUTH_ERRORS_JSON`). The three
  sibling-checkout Python parse (auth `errors.py` + stapel-core verification
  `grants.py`/`errors.py`) is gone, along with the ported remediation/en
  heuristics: the backend now declares remediation on the registry, so the
  `PROVISIONAL` note is dropped and the map is consumed verbatim. The driver
  validates every `remediation` against the finite vocabulary.

  **Superset surface.** The catalog grows from 75 to **114 keys** — the backend
  set adds the captcha, network, common, and field families. Every new key ships
  its en fallback, so `authErrorBundleEn` stays total by construction and the
  `errorsBundle` coverage test is green. `manifest.errors` and the generated
  `AUTH_ERRORS`/`AUTH_ERROR_CODES` reflect the full set.

  **llms.txt** trims the Errors section to a digest (remediation histogram +
  param-bearing keys) pointing at `manifest.json §errors` for the full catalog,
  keeping the pair's slice within its §2.4 token budget.

  CI drops the stapel-core verification-registry checkout (it existed only for the
  old parse); only the stapel-auth artifact checkout remains.

- a6c34e2: Design-system showcase (frontend-guardrails §4, task G7): `defineDemo` + a
  generated viewer + the headless-coverage completeness gate.

  **New package `@stapel/showcase`** — the demo SOURCE format. `defineDemo({ id,
title, description, component, covers?, flow?, tokens?, decorator?, variants })`
  is a literal, statically-extractable registration (mirrors `defineEvent`), plus
  `renderDemoVariant`/`variantIds` for stories and smoke tests. Viewer-agnostic:
  one `defineDemo` feeds four projections that can't drift from the component.

  **Hybrid viewer** (user-approved deviation from the spec's self-rolled Vite
  shell): the format stays ours; the VIEWER is a commodity. `gen:demos` projects
  each demo into CSF, and a thin private **Ladle** app (`@stapel/showcase-viewer`,
  Vite) renders them — chosen over Storybook for a clean, light pnpm-monorepo fit.
  `pnpm showcase` serves the whole workspace; the theme toggle drives
  `data-theme`, so demos re-theme through the G1 tokens with no JS in the token
  layer. The viewer is introspection-only — not published, not in any prod bundle
  (§5).

  **`gen:demos` driver + drift gate + completeness gate.** From
  `demo/**/*.demo.tsx` it emits `demo/generated/demos.json` + CSF stories
  (byte-stable, `pnpm gen:demos:check`), and enforces §4.2: every headless
  component a pair exports must be covered by ≥1 demo, else CI is red. Demos embed
  into `manifest.demos` + `llms.txt` (canonical compiled/linted/rendered examples)
  via `gen:manifest`.

  **`@stapel/eslint-plugin`**: new rule `demo-literal-meta` (recommended preset) —
  keeps `defineDemo` meta literal so extraction stays possible, the analogue of
  `event-literal-meta`.

  **`@stapel/auth-react`**: 13 demos covering all 14 headless exports (OTP,
  passkey login/registration, QR are the rich pilots; the rest mount + show their
  bag state). Demos are first-class code — token-styled (`cssVar`), i18n labels,
  flow-instrumented clicks (`data-analytics="flow"`), typechecked, linted with the
  product ruleset, and smoke-rendered. The pair's completeness gate is green.

  **`@stapel/tokens`**: a `Token palette` auto-demo that enumerates the generated
  token surface (L1 ramps, L2 core live var-refs, L3 component, scales) — always
  reflects the catalog, never a hardcoded list.

- 809b706: New package: headless React auth flow pair for stapel-auth (frontend-standard
  §2), built on `@stapel/core`. First instance of the framework's
  `createFlowMachine` pattern (typed steps, human-wait vs async `run`,
  auto-instrumented `flow.<id>.<step>` analytics).

  Full journeys: Email/Phone OTP, password login (with TOTP challenge branch),
  password change/reset, the step-up **verification factor flow** wired into
  core's verification-403 interception (the flagship cross-module seam), TOTP
  setup, OAuth token exchange, sessions, token refresh with rotation + teardown,
  QR login polling, magic-link request, anonymous, instant authenticator change,
  and SSO discovery. Passkeys + the passkey verification factor are flow-complete
  with a thin injectable WebAuthn binding (see MODULE.md).

  Ships typed API client (CSRF on mutations), open-redirect guards (§19.2),
  namespaced TanStack Query hooks/mutations, `createAuthRuntime` (session token
  seam + verification controller wired into the client), render-prop headless
  components, and an i18n key bundle.

### Patch Changes

- dc2a02c: Etalon re-review fixes (post G1–G8 pair review):

  - **`manifest.backend.contract`** — the manifest now states the backend semver
    range the surface was generated against (`>=0.5 <0.6`, derived from the
    stapel-auth pyproject at gen time; `MANIFEST_BACKEND_PYPROJECT` override).
    Drift becomes addressable per frontend-core-architecture §2.4/§3.4.2: a
    backend minor bump reddens the manifest drift gate exactly like a schema
    change. llms.txt header carries the same range.
  - **Demo harness: unit-correct spacing shorthands.** Size tokens are unitless
    numbers; React auto-appends `px` only to single numeric style values, so the
    two-value `padding` shorthands built by interpolation produced invalid CSS
    ("8 16") that browsers silently dropped. The canonical demos now spell the
    unit (`` `${spacing["2"]}px ${spacing["4"]}px` ``) — demos are the snippets
    agents copy, so the broken pattern must not replicate.
  - **Explicit `@stapel/core` peer range** (`>=0.3.0 <1.0.0`, floor = the release
    that ships the flow primitive the pair re-exports) instead of `workspace:^`.
    With a caret peer on a 0.x core, every core minor left the range and
    Changesets force-MAJORED the pair (the unpublished pair was heading for a
    2.0.0 first release). The wide floor+ceiling states real compatibility; the
    new `onlyUpdatePeerDependentsWhenOutOfRange` policy in the changeset config
    keeps in-range core bumps from cascading. Local dev linking is unchanged
    (devDependency stays `workspace:^`).

- c5886da: Frontier adversarial-review residuals (verification passkey auto-drive + cookie-mode session):

  - **Passkey auto-drive success path (stale credential).** The identity guard that
    keeps a late-rejecting native prompt from resurrecting a dead challenge now
    also guards the SUCCESS path: a native prompt resolving after the challenge
    moved on (cancel + a NEW challenge reaching `awaitingPasskey`) no longer
    submits the stale credential against the newer challenge's `session_key`.
  - **Cookie mode stops persisting JWTs.** `createAuthSession({ cookieMode: true })`
    no longer mirrors the token pair into JS-readable storage (IndexedDB/
    localStorage) — doing so reopened exactly the XSS-theft hole HTTP-only
    cookies exist to close. Only the user snapshot is persisted (optimistic user
    cache); `restore()` now treats a stored user as an authenticated session in
    cookie mode, and a dead cookie pair tears down via the refresh seam on the
    first request.

- 864ae02: **Manifest `hooks` section** (frontend-core-architecture §2.4 — the manifest
  promised a query-hook catalog; now it ships one). `gen:manifest` statically
  projects the model layer's exported `use*` hooks into `manifest.hooks`: each
  entry carries its `kind` (`query`/`mutation`), the operation(s) it calls
  (`api.*`/`session.*`), and — resolved against the key factory — the literal
  `queryKey` for queries (e.g. `useCapabilities → ["auth","capabilities"]`) or the
  key arrays a mutation `invalidates`. So an agent finds "the hook to read this
  resource" and "what a write refreshes" without reading the source, and review
  can confirm the SDK's hooks were used, not a hand-rolled `useQuery`. llms.txt
  gains a compact hooks list (still within the ≤4000-token budget, ~3510). Extraction
  knobs mirror the existing `MANIFEST_*` family (`MANIFEST_MODEL_DIR`,
  `MANIFEST_QUERYKEYS_FILE`); a pair without a model dir degrades to an empty
  section. Drift-gated like every other manifest section (`pnpm gen:manifest:check`).
- 6c33abc: Adversarial-review fixes (pre-release):

  - **createFlowMachine staleness guard (R1).** `run` now captures a per-run epoch
    after parking in `pending` and only applies its terminal transition (and its
    resolve/reject side effects) if no newer `to` happened meanwhile. A stale
    result from a double-submit, cancel, navigate, or expiry can no longer clobber
    the newer state. The guard lives in the primitive so every future pair
    inherits it.
  - **createFlowMachine re-entrancy (R2, frontier pass).** The staleness epoch is
    now captured atomically with the pending transition, BEFORE listeners are
    notified. Previously a subscriber that re-entrantly called `to()` from the
    pending notification advanced the generation before the run captured it, so
    the guard read the listener's epoch and the late result clobbered the
    re-entrant transition.
  - **createFlowMachine mapper fault isolation (frontier pass).** A throwing
    `resolve` mapper is no longer mistaken for a task failure (which
    double-emitted `completed`+`failed` and applied a reject state built from the
    mapper's own exception) — the task's settlement is folded into data first;
    mapper/listener throws propagate loudly out of `run`.
  - **Passkey prompt vs cancel/expiry (frontier pass).** A native WebAuthn prompt
    rejecting AFTER the challenge was cancelled or expired no longer resurrects
    the dead challenge UI as `factorError`.
  - **Expiry timer int32 overflow (frontier pass).** A far-future `expires_at`
    (> ~24.8 days) no longer expires the challenge instantly (setTimeout folds
    overflowed delays to ~1ms); bounded timers are chained instead.
  - **Cookie mode (frontier pass).** `createAuthRuntime({ cookieMode: true })`
    now defaults the client to `credentials: "include"` (overridable via the new
    `credentials` option) so HTTP-only JWT cookies actually ride cross-origin
    requests — including refresh and verification retries.
  - **Verification controller lifecycle (A2).** The controller now self-releases
    the awaited core request on the envelope's `expires_at`: an abandoned modal
    resolves `{ retry: false }` instead of hanging the original request forever
    and wedging all future challenges. A factor whose `initiate` fails
    recoverably (e.g. a 423-locked factor) returns to the picker so a different
    factor stays choosable; only a 404 (challenge gone) ends the whole challenge.

  Still NOT released — awaits final review sign-off.

- 2785f83: Harden the shared codegen drivers so a pair with **no** annotated flows
  scaffolds and builds (arch-npm-pairs prep) — auth output stays equivalent.

  - **`scripts/gen-flows.mjs`** — the emitted `flowEndpoints` now guards the
    empty-registry case. For a module the backend has not yet annotated with
    `@flow_step`, `<Module>FlowId` is `never` and `<MODULE>_FLOWS` is `{}`, so the
    old `REGISTRY[id].steps.flatMap(...)` body did not type-check and reddened a
    fresh pair's build. The body now widens to an optional spec
    (`REGISTRY[id] as {…} | undefined`) and returns `[]` when absent — valid for a
    zero-flow scaffold and unchanged in behavior once the registry fills in. Auth's
    `flows.gen.ts` is regenerated; only this function body changes (equivalent).
  - **`scripts/gen-manifest.mjs`** — the `llms.txt` prose and the i18n-key scan are
    no longer hardcoded to auth. The narrative's entry-point names
    (`<XProvider>`, `explainXError`, `xQueryKeys`, `registerXI18n`), the flow
    snippet, and the `x.` i18n namespace now derive from the react module slug and
    are each overridable via `MANIFEST_*` knobs (phase-1 style). The Machines
    section and the flow snippet are emitted only when the pair has flow
    factories. Auth defaults reproduce its surface: `manifest.json` is byte-identical
    and `llms.txt` differs only in the illustrative snippet (a real auth flow,
    generic comment).

- 0db568b: Typed analytics — `defineEvent` / `tracked` over the facade (frontend-guardrails §3, G3):

  - **`defineEvent` + `prop`** (`@stapel/core`). A typed event is a literal object:
    a namespaced `name`, a one-line `description`, and a `props` schema where every
    prop carries its OWN docstring (`prop.string`/`number`/`boolean`/`oneOf`). The
    facade's `track` gains a typed overload — `track(event, props)` checks props
    against the schema (required props enforced, unknown props rejected, `oneOf`
    narrowed to its literal union), while `track(name, props?)` stays for library
    auto-instrumentation. A tsc consumer fixture (`@ts-expect-error` proofs) locks
    the enforcement in.
  - **`tracked()` / `useTracked()`** (`@stapel/core`). `tracked(event, props, handler)`
    wraps a clickable so the click both emits the typed event and runs the original
    handler; `useTracked()` binds it to the facade from context (SSR-safe — no
    mutable module singleton). `trackedSubmit` is the `onSubmit` twin.
  - **Double-count exclusion by construction.** A click that STEPS a flow machine is
    already instrumented (`flow.<id>.<step>`), so it must be marked
    `data-analytics="flow"` and NOT wrapped in `tracked()`. G4 forbids the double
    wrap statically; the facade backs it in dev — while a `tracked()` handler runs,
    a `flow.*` emission on the same instance is flagged with a teaching warning (a
    flow transition fires `started` synchronously, before the first await, so a sync
    scope catches it).
  - **Runtime-configurable flow instrumentation.** `createFlowMachine({ instrument })`
    can silence a machine's auto-funnel while keeping the facade for hand-rolled
    events (default stays on when `analytics` is present).
  - **`events.json` (generated, drift-gated).** New `gen:events` driver projects a
    pair's event registry — `defined` (defineEvent call sites, AST-extracted) +
    `flows` (auto-instrumented funnels from flows.json) — into
    `src/analytics/generated/events.json`, the single source the analytics lint (G4)
    and report (G5) read. `gen:manifest` embeds it into `manifest.json` (`events`)
    and `llms.txt`. auth-react ships its funnel registry and a typed-events
    demonstration (no full annotation of the pair).

- Updated dependencies [5dfa61e]
  - @stapel/core@0.2.0

## 0.1.0 (unreleased)

Initial headless auth flow pair for stapel-auth (frontend-standard §2), built on
`@stapel/core`. First instance of the framework's `createFlowMachine` pattern.

- **flows/** — `createFlowMachine` primitive (typed steps, human-wait vs async
  `run`, auto-instrumented `flow.<id>.<step>` analytics) + machines for OTP,
  password login (with TOTP branch), password change/reset, step-up
  verification, TOTP setup, OAuth, QR login, magic link, anonymous,
  authenticator change, SSO, and passkeys.
- **api/** — typed client over `StapelClient` for the auth-sa.md endpoints
  (CSRF header on mutations), browser-redirect URL builders, and the §19.2
  open-redirect guards.
- **model/** — `createAuthRuntime` (wires the session token seam and the
  verification-403 controller into the client), `AuthSession` (refresh rotation
  - teardown + persistence), namespaced TanStack Query hooks and mutations.
- **headless/** — render-prop components incl. the flagship
  `<VerificationChallenge>` factor UI, plus `<AuthProvider>`.
- **i18n/** — auth-react key bundle registered into core's engine.

Passkeys and the passkey verification factor are flow-complete; the WebAuthn
browser binding is a thin injectable seam (see MODULE.md).

**NOT released** — awaits independent adversarial review.
