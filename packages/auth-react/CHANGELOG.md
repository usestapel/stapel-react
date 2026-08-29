# @stapel/auth-react

## 0.18.1

### Patch Changes

- 042a088: An anonymous visit costs zero auth requests in cookie mode.

  `bootstrapProbe: "auto"` consulted the `stapel_auth_hint` cookie only in
  bearer mode; cookie mode probed unconditionally. So a public storefront in
  cookie mode — the default — opened every cold `restore()` with a
  `/token/refresh/` call against an empty cookie jar: two 401s on every
  anonymous visit and every crawl, measured live on southgate.test, looking for a
  session the hint cookie already said was not there. On a classified where
  80–95% of traffic is exactly that visit, it was the first thing every visitor
  and every bot paid for.

  The gate is now one rule for both modes: `"auto"` probes when the hint cookie
  is present, `"always"` probes regardless, `"off"` never probes and still warns
  once. `stapel-auth` sets the hint alongside every httponly pair it mints, so a
  signed-in visitor is unaffected — the QR/magic-link/SSO cold-load discovery
  this probe exists for keeps working exactly as before.

  A LIVE 401 is untouched: `doRefresh`'s early-out stays bearer-only, so a
  cookie-mode request that meets a 401 mid-session refreshes as it always did.
  Only the cold bootstrap SEARCH — the one with no evidence a session ever
  existed — is gated.

## 0.18.0

### Minor Changes

- 5c6126d: Auto-anonymous: a gated action can mint an identity instead of refusing.

  A marketplace visitor who has not registered could read the catalogue and do
  nothing with it. Saving a listing and writing to a seller are the two acts the
  product exists for, and both answered "sign in first". They no longer do: the
  press mints a guest account silently and then performs the act.

  - `@stapel/core` gains the elevation seam — `ElevationSource`,
    `<ElevationProvider>`, `useElevation(action)`. It is per-ACTION on purpose.
    The mandate axis is untouched by a mint, so a minted guest stays
    `"anonymous"` and every action a deployment did not name keeps its wall.
  - `@stapel/auth-react` gains `createAuthRuntime({ autoAnonymous: { actions } })`
    and `createAnonymousElevation`, implementing that seam over
    `POST /anonymous/`. It never mints on render, collapses concurrent presses
    onto one mint, and persists a `device_id` so a reload does not abandon the
    first guest along with what they saved.
  - `@stapel/listings-react` exports `LISTINGS_ELEVATION_ACTIONS` and
    `useElevatableMandateGate`; the favourite heart takes the named action.
    Publishing deliberately does not.
  - `@stapel/chat-react` exports `CHAT_ELEVATION_ACTIONS`; "message the seller"
    takes the named action.
  - `@stapel/reviews-react` exports `REVIEWS_ELEVATION_ACTIONS` and now refuses a
    mandate-less visitor BEFORE the click rather than after it. It also
    recognises `error.403.reviews_anonymous_not_allowed`: a signed-out visitor
    is refused with 401 and a minted guest with 403, and both mean "you need an
    account", so `isSignInRequired` reads both.

  `@stapel/auth-react` also gains `<AuthPanel showGuestEntry>`. With the axis
  open the backend advertises `registration.anonymous` and the panel would draw
  "Continue as a guest" — on a host that mints automatically that button mints a
  session and leaves the person on the sign-in screen, which is the silent
  control that got the capability switched off somewhere once already. The
  server's statement stays true; the host says whether it is obtained by
  pressing that.

  WHICH actions may mint is a host's list, not a library default. A host that
  wires nothing sees no change: every gated control refuses exactly as before.

## 0.17.1

### Patch Changes

- 31f1af6: Close the third visual review's blockers in the default skin: the flagship page renders, the panel family is on the token layer, and the showcase stops shipping debug cards.

  **The composed security page drew nothing.** `demo/fixtures.ts` answered
  `GET /password/methods/` with a bare array where the contract sends
  `{ methods, has_password }`, so `PasswordChangePanel` reached `matchList`'s
  ready arm with `undefined`, threw inside render, and React unmounted the whole
  tree — an all-white `SecuritySettings` page (and `change-password`) with
  nothing in the console. The fixture matches the contract now, every
  `mapLoad` projection over an optional array degrades to the designed empty
  state instead of throwing, and `test/demos.test.tsx` asserts what a reviewer
  looks for on **every variant of every demo**, not just "it mounted": ink on
  the canvas, no raw i18n key in the rendered text, no console error.

  **One seam, thirteen dark-mode failures.** `TotpManager`, `QrDeviceLinkPanel`
  and the four `*ChangePanel`s never wrapped themselves in `SkinTheme`, so they
  painted a light card on a dark document and shipped antd's stock `#1677ff`
  beside the project's indigo. The token layer now lives inside the new
  `SecurityCard` primitive that every security and console widget wears, so a
  widget cannot forget it; the `<Badge color="blue">` backup-codes chip is a
  token-neutral `Tag`; and the two hand-rolled `toLocaleDateString()` helpers
  are `@stapel/core`'s `useFormat` (no more `9/1/2026`).

  `SecurityCard` also replaces antd's `<Card title extra>` header, whose title is
  `nowrap` + ellipsis: `Active se…`, `Two-factor au…` and the passkeys header
  painting over its own rule are all gone, the header wraps instead. Audit rows
  (both the security log and the operator console) moved onto `SecurityListRow`,
  so the `Unrecognized activity` badge occupies grid space beside the timestamp
  instead of floating over it, and connected-accounts rows stop breaking
  `Goo`/`gle` mid-word.

  **A refusal is not a fault.** A 403 on any of the four operator consoles now
  renders a stated refusal — padlock, explanation, no `Try again` — and gates the
  page's own primary action through `GatedButton` with the reason beside it,
  instead of a generic alert under a live `Issue a key`. The audit filters use
  the design system's `DatePicker` rather than a bare `<input type="date">`.

  **Stories.** 13 of the 15 legacy harness demos are deleted — every screen they
  stood in for has a real skin story, now declared through `covers:` (the two
  whose headless component has no skin yet, `PasswordReset` and
  `VerificationChallenge`, stay and are filed as a gap). The
  `authenticator-change` story mounted the email panel and photographed
  identically to it; it now mounts both channels, which is the claim it makes.
  Byte-identical sibling variants are seeded apart or removed, the MFA-enrol
  happy path answers `POST /totp/setup/` instead of rendering its own failure,
  and the demo fixtures use error codes that exist in the bundle — `error.500.server`
  and `error.503.unavailable` were invented, so the refusal states printed the raw key.

  Copy: a channel label interpolated into a sentence takes a new inline form
  (`auth.ui.channel_{email,phone}_inline`), so "Your old Phone has been notified"
  reads "Your old phone…" and `Current Email:` / `Change Email` are sentence case;
  step-up scopes render `Wallet withdraw`, never `wallet.withdraw`. New keys ship
  in en/ru/es.

## 0.17.0

### Minor Changes

- 308e3d6: The operator console, the step-up preferences screen, passkey rename, and Spanish — the pair's admin half and its last untranslated locale.

  - **Passkey rename (stapel-auth 0.28.0).** `PATCH /passkey/{id}/` is in the regenerated contract, so `PASSKEY_RENAME_SUPPORTED` is `true` and `<PasskeysManager/>` renders the rename row and its dialog. The compile-time tripwire on `paths[…]["patch"]` stays live in both directions: a regen against a backend without the route fails the build at that one constant rather than shipping a control that answers 405. A **404 from rename or remove is read as "this row is stale"** — the backend scopes both per-credential routes by an ownership _lookup_, so somebody else's id and a deleted id are byte-identical answers and neither is a permission problem; the list is refetched and the sentence says the credential is gone.
  - **New: `@stapel/auth-react/default/admin`** — five staff-only screens over the admin half of the contract: `SsoOrgsPanel` (organizations, their domain routing, and the identity-provider connection), `ServiceKeysPanel` (issue, switch off, delete; the secret is handed over once, in a dialog that says so), `StaffRolesPanel`, `AdminUsersPanel`, `AdminAuditPanel`. A separate subpath so a consumer shipping only the end-user surface never bundles them; five nav entries under the container-owned `admin.root`, `surface: "member"` declared rather than derived. The identity-provider form states that it **cannot show the current values** — the contract has `PUT`/`PATCH` on an org's config and no `GET` — and saves the whole connection instead of composing a patch against values nobody could read.
  - **New: `VerificationPreferences`** (`./default`, and a section on `SecuritySettings`). Rows are sparse by contract, so a scope with no preference row renders with **no selection** and the line "Follows this app's default": the client is never told the endpoint's own level, and a switch drawn in the off position would be a confident lie about a security setting. The cost of switching a scope off — it is itself step-up protected — is printed beside the controls, not raised by the 403 that follows.
  - **Spanish UI copy.** `./i18n/es` carried generated error texts and English screens; it now carries the pair's own 352 keys plus the 33 error codes the pair re-words, so an `es` host reads one language. `ru` gains the same 33 re-worded error texts, which it had been silently falling back to the plainer generated sentence for.
  - **21 default-skin demos** — every `src/default` export and every nav `component.export` is drawn, each with a phone variant and its states seeded at named steps (empty, refused, blocked, mid-cooldown), replacing stories that photographed the headless debug harness.
  - Doctrine cleanup: the last three `Popconfirm`s (`AuthenticatorChangePanel`, `TotpManager`, `OAuthLinks`) are `SkinConfirm`; the last three raw `<Empty>`s (`AuditLogPanel`, `OAuthLinks`, `PasswordChangePanel`) are `EmptyState` with a hint; the audit log's suspicious marker is a **named chip** rather than a bare `!` a screen reader announces as nothing, and its timestamps use the app's locale, not the browser's. Per-row destructive and connect controls carry an `aria-label` naming what they act on.
  - **Breaking (pre-1.0, hence minor):** `SecuritySettings` gained a `verificationScopes` prop and an "Extra verification" section; `OAuthLinks`' disconnect button's accessible name is now `Disconnect {provider}`; peer floors move to `@stapel/core >=0.18.0 <1.0.0` and `@stapel/tokens-antd >=0.6.0`.

- 95e8eec: The passkeys settings row is about a credential, not about signing in.

  It showed a name and a green button whose label is the SIGN-IN button's copy
  in every locale — offered to someone who is, necessarily, already signed in.
  That came from the add-journey's success step reusing `auth.ui.submit` as its
  dismiss button; it says `auth.sec.passkeys.done` now, which is what the button
  does.

  The row itself answers what a credential-management row has to answer: the
  device name, WHAT the credential lives in (read from `transports[]` — the
  fingerprint reader in this laptop, a security key, a phone over Bluetooth: three
  very different answers to "can I use this right now", and none of them was on
  screen), when it was added, and when it was last used — or, honestly, that it
  never has been, which is how a person spots the key they enrolled and lost.
  "Add a passkey" becomes "Add another" once one exists.

  Removal confirms in the fleet's `SkinDialog` instead of a `Popconfirm`: a
  popover anchored to a small link button renders off-viewport on a phone with
  Ok/Cancel below the touch minimum, and this particular Ok permanently deletes
  a sign-in credential.

  "Add" is now BLOCKED, with its reason printed beside it as text, where the
  browser has no WebAuthn and no binding is injected. The screen always knew that
  fact; it used to spend it only after the click, from inside a ceremony that can
  never complete.

  RENAME IS DELIBERATELY ABSENT and not faked: the contract is `GET /passkey/`,
  `POST /passkey/register/{begin,complete}/` and `DELETE /passkey/{id}/`, so
  `device_name` is writable exactly once, at register-complete. A rename button
  here would be the same defect as the sign-in button it replaced. The backend
  needs one additive route — `PATCH /passkey/{id}/ {"device_name": …}` — and the
  row is shaped so that adding it is a button, not a redesign.

  Also in this package: `AuthPanel`, `QrDeviceLinkPanel` and `TotpManager`'s two
  dialogs now render through `@stapel/tokens-antd/skin`'s `SkinDialog`, so they
  are bottom sheets on a phone. The TOTP pair mattered most — a QR code and a
  six-digit field are the worst possible content for a centred desktop modal on a
  phone.

- 95e8eec: The passkey flow is inverted: the system prompt is the first screen, and our
  sheet appears only when the ceremony did not sign the person in.

  Clicking "Passkey" used to open OUR dialog, which contained a "Use a passkey"
  button, which raised the browser's WebAuthn prompt. Two screens of ours in
  front of the one screen that decides anything, on neither of which the person
  had a choice to make. `pick("passkey")` now calls
  `navigator.credentials.get()` immediately and renders nothing; the button
  carries the pending state, because with no dialog of ours it is the only place
  anything can be seen to be happening.

  **Five outcomes, five sentences.** A ceremony rejection is a `DOMException`,
  not a `StapelApiError`, so `toFlowError` folded cancelled / no-credential /
  timed-out / insecure-origin / authenticator-refused into one shrug —
  "Something went wrong. Please try again." — which is wrong for four of them
  and worst for the most common, where "try again" is advice to repeat what
  cannot work. `classifyWebauthnError` reads the `DOMException` name,
  `toPasskeyFlowError` maps it to its own i18n key, and the fallback sheet
  branches on `passkeyFailureOf` to decide which ACTION to show: a retry for a
  timeout, the other methods for a decline, and nothing to retry at all for a
  browser that cannot do this. Cancelled and no-credential stay ONE outcome
  whose copy says both — WebAuthn refuses to separate them, because reporting
  the difference would make the prompt an oracle for whether an account exists
  on the device.

  A browser with no WebAuthn now starts no ceremony at all, where it used to run
  a `begin` round trip and park on `awaitingAssertion` behind a spinner.

  New public surface: `usePasskeyLogin()` (the hook `<PasskeyLogin>` is now a
  thin wrapper over — a render prop cannot be driven from outside the subtree it
  renders, and the button that starts this is outside), `classifyWebauthnError`,
  `WebauthnFailure`, `toPasskeyFlowError`, `passkeyFailureOf`.

## 0.16.1

### Patch Changes

- Bumps the `stapel-auth` contract pin from v0.20.1 to **v0.25.2** and regenerates
  `api/generated/schema.ts`, `i18n/generated/errors.*`, `manifest.json` and
  `llms.txt` against it — and closes the tracked gap **#141** (`email_mock` /
  `phone_mock` reported by the backend and read by nobody).

  The pin bump is what makes a mocked stand usable. Until v0.25.2 the backend
  computed the OTP code width twice — the issuing path read `MOCK_OTP_CODE`, the
  capabilities contract reported `OTP_LENGTH` — so a stand with mocked delivery
  handed out a four-character code while telling this pair codes are six digits.
  `<OtpPanel/>` was already doing the right thing (reading `otp.email_code_length`
  instead of hardcoding) and therefore drew six boxes nobody could fill. The
  backend now derives both from one function, so the panel renders the right
  number of cells with **no change on this side**: the pair reads the number, it
  never computes one.

  The gap #141 half is new UI: when capabilities say the active channel's delivery
  is mocked (`login.email_mock` / `login.phone_mock`), the code step now carries a
  subtle hint that nothing was actually sent — otherwise "Code sent to
  a\*\*\*@b.com" is a sentence the user waits on forever. It never renders the
  configured code itself, which is a credential. English and Russian copy ship
  with it (`auth.otp.mock_delivery`); Spanish falls through the en floor like the
  pair's other UI keys.

  The v0.20.1..v0.25.2 span also lands, by regeneration: the GDPR surface auth now
  exposes (`/dsar`, `/erasures`, `/me/erasures`) and its 15 `stapel_gdpr`-owned
  error keys, QR sign-in on the desktop, the user projection, and the 2026-08-11
  security wave (OTP codes in stapel-core's TTL store, hourly OTP send limits,
  anonymous minting caps, default-deny permissions, the legacy `POST /token/`
  bypass closed). No flow machine moves — `docs/flows.json` is unchanged.

## 0.16.0

### Minor Changes

- 777f6d2: The `login_request` QR sign-in had no second half.

  The pair renders a `login_request` QR on the sign-in screen and polls it, and
  stapel-auth's `/qr/{key}/scan/` redirects a signed-in scanner to
  **`/qr-confirm?key=…`** — a path hardcoded in the backend. Nothing in this pair
  rendered at that path, listed it in the nav manifest, or documented it. Every
  host therefore resolved it through its own catch-all: the phone landed on the
  home page looking like a success, `POST /qr/{key}/confirm/` was never sent, and
  the device showing the code polled a key nobody would ever fulfil. Neither
  device raised anything — no error was possible, because nothing failed; a route
  simply was not there.

  - `<QrConfirmPanel/>` (`@stapel/auth-react/default`) is that screen: it states
    what is being approved, approves (`useConfirmQrLogin`) or declines
    (`useRejectQrLogin` — a decline is _sent_, so the waiting device is answered
    instead of left staring at a code for the full TTL), and states a refusal
    from either call. It reads `?key=` off the address when the host does not
    pass one, so the nav scaffold's prop-free mount works.
  - `navEntries` now declares `auth.qr_confirm` at `/qr-confirm`, so a host that
    mounts the pair's routes gets the screen the backend already redirects to.
  - `useConfirmQrLogin` / `useRejectQrLogin` are exported for hosts with their
    own visuals.

  Separately, the sign-in QR channel no longer fails in silence. `QrPanel` mapped
  every failure onto `<QRCode status="expired">` and nothing else — a slightly
  greyed square, indistinguishable from a code that merely aged out, with no
  message and no console line. `error.403.qr_device_mismatch` (polling a key this
  browser did not mint) is the case that made it unmissable: waiting cannot fix
  it, and waiting was the only thing the panel suggested. It now states the
  reason and offers a retry, the way its sibling `QrDeviceLinkPanel` always has.

  And a delivered grant the session refuses is no longer announced as a success.
  `login_request` fulfilment hands the polling device a bare token pair;
  `AuthSession.setTokens` answers `null` when the server rejects it, and
  `createQrLoginFlow` used to discard that answer — it settled `fulfilled`, the
  panel drew a success, and the person was not signed in and was told nothing.
  `onAuthenticated` may now report its outcome, and a `null` settles
  `error` with `auth.qr.error.session_not_adopted`.

## 0.15.1

### Patch Changes

- a8bd3f4: Raise the `@stapel/core` peer floor to the version that actually exports what each package imports.

  `@stapel/workspaces-react` 0.15.0 shipped declaring `>=0.12.0` while importing
  `LoadState`, which core did not export until 0.13.0. npm installed it happily;
  the host's typecheck then failed on a type the package's own `.d.ts` referenced
  and the host could not resolve. Nine packages were wrong the same way — most by
  a wider margin (`recordings-react` allowed 0.3.0).

  Nothing here could have caught it by building: in this monorepo every package
  compiles against the workspace core, always the newest one, so a declared floor
  is never the version anything is compiled against. `pnpm check:peer-floors` now
  reads each package's imports from `@stapel/core`, asks core's own tagged history
  which release first exported each name, and fails when the floor is older —
  wired into CI **and** the publishing path, since a gate only on the merge path
  does not stop a release.

  Also invalidates the workspace audit query after an invite, a role change and a
  removal: the history sits beside the roster and an admin who acts on one expects
  to see it in the other. Its key is its own root, so the members invalidation did
  not reach it.

## 0.15.0

### Minor Changes

- 400f9e6: Security skins no longer render a failed read as an empty one: the sessions,
  passkeys, connected-accounts, password-methods and audit-log surfaces render
  through `matchList`, so "there is nothing here" is reachable only from a load
  that actually succeeded, and a failure states itself with a retry. A failed
  capabilities read also keeps the "Connected accounts" section instead of
  deleting it, and OAuth "Connect" now prints its blocked reason as visible text
  (`useActionGate`) rather than a tooltip on a disabled button.

## 0.14.0

### Minor Changes

- a5b8faa: Spanish ships as a locale of the pairs: the `./i18n/es` subpath

  Each of these five pairs gains a generated Spanish error bundle
  (`src/i18n/generated/errors.es.gen.ts`) and the `@stapel/<pair>/i18n/es` subpath
  that makes it reachable — `registerXI18nEs(engine)`, mirroring the existing `ru`
  contour. Key counts, complete over each backend's error registry by
  construction: auth 127, workspaces 67, profiles 53, billing 53,
  notifications 43.

  **Declared coverage — read this before adopting.** The `es` bundle translates
  the BACKEND ERROR CODES only. The pairs' own UI copy (`AUTH_I18N_KEYS` and its
  siblings) has no hand-written Spanish yet, and `registerXI18nEs` deliberately
  registers the en floor UNDERNEATH the Spanish texts, so those keys resolve to
  their English text — never to a raw key. A Spanish-speaking user therefore reads
  Spanish error messages and English UI copy. That boundary is asserted in each
  pair's `test/i18nEs.test.ts`, not left to be discovered. Hand-written Spanish UI
  copy lands later, additively: the subpath and the `xI18nBundleEs` export keep
  their names and shapes when it does.

  The locale stays out of the main entry (size-limit budget per subpath + a
  module-graph purity test), so hosts that never register it carry none of it.

  Regenerated against bumped contract pins — auth v0.20.1, notifications v0.7.1,
  billing v0.6.1, workspaces v0.22.1 (profiles was already pinned at v0.12.0,
  which already carried its catalogue). Besides the catalogues, those pins bring:

  - **auth** — two new error codes, `error.403.privileged_account` and
    `error.403.registration_closed`; and the OTP `code` field's documented length
    goes 4 → 8 digits across the password/TOTP/disable-otp request bodies. In the
    emitted TypeScript this is a doc-comment change only (`maxLength` is a runtime
    validation, not a TS type), so no generated type moved.
  - **workspaces** — one new error code, `error.503.profiles_not_configured`: the
    deployment-has-no-profiles-service half of the member-rename 503, distinct
    from `error.503.profiles_unavailable` (the call was made and failed).
  - **notifications** — the push-token register/unregister permission is restated
    as `IsNotAnonymousUser`; OpenAPI description prose only.
  - **billing** — nothing but the catalogue and the backend-version pin.

  No path, method, field or type was added, removed or retyped in any pair's
  generated `schema.ts`. `calendar-react` and `recordings-react` are deliberately
  untouched: `stapel-calendar` and `stapel-recordings` ship no locale catalogues at
  all (they have no Russian either), and a fabricated empty Spanish file would only
  make the set look uniform.

## 0.13.0

### Minor Changes

- c5c0a11: Default skins render the error surface through core's split copy: the human
  sentence as the alert's message, and the technical detail (`HTTP 500`) as a
  muted, small description beside it instead of a protocol number spliced into
  the sentence. Requires `@stapel/core >= 0.12.0`.

## 0.12.3

### Patch Changes

- 3ac8297: fix: the error surface a 500 puts on screen — readable, and in the user's language

  Two defects an owner hit behind a backend 500 on a live sandbox, both fixed at
  their root rather than at the one alert that showed them.

  **The alert was unreadable on a dark deployment.** `@stapel/tokens-antd`'s
  `readLiveCssVar` served the host's LIVE `--stapel-*` custom properties for
  whatever mode the caller asked for — but those properties resolve through the
  document's active `data-theme`, so they are the DOCUMENT's mode, not the
  caller's. A default skin defaulting `mode` to `"light"` inside
  `<html data-theme="dark">` therefore got antd's LIGHT algorithm (deriving
  `--ant-color-error-bg: #fff2f0`, near-white) welded to a LIVE DARK
  `--ant-color-text: #f4f5f7` — measured 1.00:1 contrast.

  - `resolveThemeMode()` (new export) reads the same `data-theme` attribute
    `@stapel/tokens`' `tokens.css` keys its dark block on. `mode` is now optional
    on `toAntdTheme`/`toAntdThemeConfig` and defaults to it.
  - `readLiveCssVar` serves a live value only when the document is in the mode
    being asked for; otherwise the compiled-in default for the REQUESTED mode.
    The bridge can no longer emit a blended theme.
  - Every `@stapel/profiles-react` default skin defaults `mode` to
    `resolveThemeMode()` instead of `"light"`, so it self-themes with no host
    wiring. Pass `mode` explicitly to pin a side.

  **The alert showed `Request failed with status 500`.** That is
  `parseErrorEnvelope`'s own diagnostic for a response with no error envelope (a
  Django 500 under `DEBUG=False` returns HTML) — the HTTP client's internals, in
  English, on a Russian UI. The one-dialect machinery existed but had no rung a
  query/mutation-driven skin could reach, and no catalogue behind the codes core
  itself mints.

  - `@stapel/core` now ships an error FLOOR (`stapel.http.*`,
    `stapel.transport.failed`, `stapel.error.unknown`) in en and ru, seeded by
    `createI18n` under every locale before any caller bundle — a host wires
    nothing, and any pair or host bundle registered later still wins the key.
  - `useErrorText()` (new export) folds ANY thrown value into that dialect in one
    call, which is what a skin holding `error: unknown` needed.
  - `formatFlowError` exposes the error's HTTP `{status}` to templates and widens
    core's OWN `stapel.http.<status>` codes to a class-wide `stapel.http.5xx`
    entry. Real backend codes are never widened — two different 404s stay two
    different states.
  - Default skins across profiles-react, auth-react, notifications-react and
    workspaces-react now render `useErrorText(...)` instead of `error.message`.

## 0.12.2

### Patch Changes

- 3dfb47e: The /default skin can be imported by Node, not only by a bundler.

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

## 0.12.1

### Patch Changes

- Passkeys work with no host code: the browser WebAuthn ceremony ships in the library

  `navigator.credentials.create()/get()` used to be the host's job entirely
  ("Thin-WebAuthn TODO") — and a host that never wrote it got a passkey flow
  wedged forever in `awaitingCredential`/`awaitingAssertion`. The default
  binding now lives in the pair (`src/webauthn.ts`, no new runtime dependency:
  the base64url⇄ArrayBuffer conversion stapel-auth's wire format needs is
  hand-written), so registration, passkey login and the `passkey` verification
  factor drive themselves.

  Backwards compatible: an injected `webauthnCreate`/`webauthnGet` (flow,
  `<Passkey*>` prop, `createAuthRuntime`) still wins, and an environment with no
  `navigator.credentials` (SSR, an old browser) keeps the previous thin
  behaviour — the machine parks on `awaiting*` for the host to drive, and the
  /default skin shows the new honest `auth.passkey.unsupported` copy instead of
  pointing at a prompt that will never appear.

## 0.12.0

### Minor Changes

- OTP boxes are rectangles, and the resend countdown is the server's number.

  **Shape.** 1:1 made each box read as a button rather than a slot for one
  character. They are now 3:4 — taller than wide, the shape every familiar OTP
  field uses — and still shrink proportionally instead of flattening.

  **Countdown.** The skin counted down a hardcoded 30 s while the backend
  enforced `OTP_RESEND_COOLDOWN`, a setting. Two copies of one truth, and the
  UI's copy is the one users obey: raise the setting and the button unlocks
  early into a rate-limit error; lower it and people wait for nothing. The OTP
  flow now carries `resendAfter` from the send response
  (`resend_cooldown_seconds`) into `codeSent`, and the skin counts that. The 30 s
  constant survives only as a floor for a backend too old to send the field.

  Noted while wiring it: the generated API type for the OTP-request response
  does not carry `resend_cooldown_seconds` even though the OpenAPI schema
  declares it, so the value is read defensively rather than through a cast that
  would claim more than the client type knows.

## 0.11.1

### Patch Changes

- OTP boxes stay square when they have to shrink.

  0.11.0 diagnosed this backwards. I assumed the row was STRETCHING and capped
  its width; `.ant-otp` is `inline-flex` with no width of its own, so it never
  stretched. The boxes were being SQUEEZED: each inner input is a normal antd
  Input at `width: 100%` with the default `flex-shrink: 1`, so when the row has
  less inline space than the boxes need, flexbox takes the difference out of
  their width while their height stays put — square becomes rectangle. The
  0.11.0 fix therefore changed nothing on a phone, which is exactly what was
  reported back.

  The fix belongs on the boxes, not the row. Via antd v6's `input` slot each box
  now gets `aspect-ratio: 1` with `height: auto` (so width and height shrink
  together and a box that must get smaller stays square), `min-width: 0` (a flex
  item will not shrink past its content width without it — the whole problem),
  and `flex: 1 1 0` (all boxes shrink at the same rate instead of one collapsing
  first). A caller passing the function form of `styles` keeps full control.

## 0.11.0

### Minor Changes

- Guest entry is a button, and the OTP boxes keep their shape on mobile.

  **Guest entry.** "Continue as guest" was a `Typography.Link` small enough to
  miss, so every host that cared about it drew its own prominent CTA beside it —
  and ended up with TWO guest entries on one screen (3571.meettoday.app,
  2026-07-29). The canonical form is now a full-width `Button` with a hint line
  underneath, which removes the reason to add a second one. It stays
  `type="default"` rather than primary: guest entry is the alternative to signing
  in, not the recommended action. New key `auth.ui.continue_as_guest_hint`
  (en + ru).

  **OTP shape.** antd's OTP boxes are flex children that grow to fill the row. In
  a desktop form the row has a fixed width so nothing stretches; inside a
  full-bleed mobile layout the same row is viewport-wide, and the boxes stretch
  horizontally while keeping their height — squares become flattened rectangles.
  All five OTP call sites now go through one `OtpField` wrapper that gives the
  field its natural width and centres the BLOCK. Deliberately not fixed by
  padding the container until it looks right: centring by squeezing is a
  coincidence that breaks at the next breakpoint.

## 0.10.3

### Patch Changes

- e98ac8d: A negative bootstrap probe is no longer reported as a session loss.

  Second and deeper cause of the redirect strobe (owner-reported, 2026-07-26).
  `restore()` runs a bootstrap probe when it finds none of its own persisted
  state — a SEARCH for a session, not a check of one. Its 401 was settled
  through the same path a live 401 uses, so if anything had marked the manager
  authenticated in the meantime, the probe's negative answer tore that session
  down and fired the host's redirect policy.

  That race is ordinary, not exotic: a host with its own auth context calling
  `GET /me/` on mount will win it routinely. Against a server holding a live
  access cookie and a dead refresh cookie — a state it is entitled to be in —
  /me answered 200 while the probe answered 401, and the two verdicts chased
  each other: teardown, hard redirect to /sign-in, reload, /me 200 again,
  sign-in bounces to /app, probe 401 again. 222 requests before it happened to
  settle.

  Finding nothing is not losing something. A probe now settles quietly and
  never tears down; a live 401 still does, unchanged.

## 0.10.2

### Patch Changes

- 8aa7b30: The persisted user is really gone before a teardown reports done.

  Owner-reported live incident (2026-07-26): opening the app produced a
  strobe of redirects between `/app` and `/sign-in` — 222 requests in a loop
  before it happened to settle.

  The trigger was a server in a legitimate but inconsistent state: `GET /me/`
  answered 200 off a still-live access cookie while `GET /token/refresh/`
  answered 401 off a dead refresh cookie. A client has to survive that. What
  turned it into a redirect storm was here: the logout hook started an async
  wipe of the persisted user snapshot and returned `undefined`. Since
  `runLogoutHooks` awaits its hooks, the session manager considered teardown
  finished while the delete was still in flight; the host's `onSessionLost`
  policy then ran a hard `window.location.href` redirect, and the page died
  before IndexedDB committed. The reloaded page restored the very user it had
  just been told to forget, the sign-in screen saw a session and bounced back
  to `/app`, whose refresh 401'd again — and the loop only ended when a wipe
  happened to win a race against a navigation. "It flickered and then settled"
  is exactly what that looks like from outside.

  The hook returns its promise now, so the wipe is part of the teardown rather
  than a race against it.

## 0.10.1

### Patch Changes

- 8c4f9c2: An unreachable backend no longer logs the user out.

  Owner-reported live incident (2026-07-26, app.ironmemo.com mid-redeploy):
  "сервак явно не отвечал, но фронт меня выкинул на sign-in page. Ну да, не
  получилось отрефрешиться или auth/me вызвать, но это же не повод сессию
  терминейтить, юзера не разлогинило, бэк прилёг."

  A refresh had two outcomes — success, or "session lost" — so every way of
  _not_ getting an answer (fetch threw, DNS/TLS failed, the request timed out,
  nginx answered 502/503/504 because the upstream was restarting, the service
  5xx'd on its own crash) was filed under the same verdict as a clean 401, tore
  the session down, ran the logout hooks, purged user-scoped storage and fired
  the host's redirect-to-login policy. On a signed-in user whose credential was
  perfectly valid.

  Only the auth service can retire a credential, and only by answering. So
  there is now a third outcome, `REFRESH_UNAVAILABLE`: no verdict was obtained,
  the session is left exactly as it was, `refresh()` still resolves `false` (the
  caller's request genuinely got no token and should surface its own error), and
  `session:refresh-unavailable` is emitted for hosts that want an "offline /
  reconnecting" affordance. The next attempt, once the backend is back, simply
  succeeds. A `doRefresh` that _throws_ is treated the same way — an exception is
  not evidence a credential is dead, and the old behavior turned any bug in the
  refresh path into a forced logout.

  `@stapel/auth-react` classifies: 401/403 (and other 4xx that are genuine
  rejections) are verdicts; transport failures, 5xx, 408 and 429 are not. 429
  especially — being rate-limited is a "come back later", and logging the user
  out over it is exactly backwards. The same rule now governs the token-adoption
  path: a `me()` that never reached the server keeps the tokens instead of
  discarding them. A COLD start against a dead backend still settles (quietly,
  no banner) so nothing gated on `whenReady()` hangs.

## 0.10.0

### Minor Changes

- b8e82c7: `<SecuritySettings/>` now hides the whole "Connected accounts" group when the deployment has no OAuth providers configured (`capabilities.registration.oauth` empty) instead of showing the group's heading over `<OAuthLinks/>`'s empty-state card ("No providers configured.") — dead chrome for an end user on a deployment that never wired OAuth. Standalone `<OAuthLinks/>` usage is unchanged (its own empty state is still there for hosts that render it outside `SecuritySettings`).

## 0.9.0

### Minor Changes

- 2f27177: Org-program wave (spec §E, stapel-auth 0.12.0 contract): login grant + first-login enforcement.

  - **api**: `exchangeLoginGrant(grantToken)` (`POST /grant/exchange/` — the workspaces invite-claim seam; adopt the result via the runtime session), `completeForcedPasswordChange({challengeToken, newPassword})` (`POST /password/forced-change/`), `mfaEnrollExchange(challengeToken)` (`POST /mfa/enroll/exchange/` → limited enroll-only session). `passkeyRegisterComplete` now returns `PasskeyRegistered` (passkey + optional full-session `tokens` from an enroll-only session).
  - **types**: `FirstLoginChallengeResponse` / `FirstLoginRequires` / `isFirstLoginChallenge` — `LoginResponse` is now a three-way union (`AuthResponse | TOTPChallengeResponse | FirstLoginChallengeResponse`); `MfaEnrollSessionResponse`; `TotpSetupConfirmResponse.tokens`.
  - **flows**: `passwordLoginFlow` routes the `FIRST_LOGIN_REQUIRED` intermediates into the new `passwordChangeRequired` / `mfaEnrollRequired` resting steps (same pattern as the TOTP challenge). New `createForcedPasswordChangeFlow` (retry-in-place on a rejected password; chains into the mfa_enroll challenge when both policy flags are set) and `createMfaEnrollFlow` (exchange → enroll → `complete(tokens)`), both under the canonical `auth.first_login` registry id. `TotpSetupState.done` / `PasskeyRegisterState.registered` now carry the enroll-upgrade token pair.
  - **headless**: `ForcedPasswordChange` (render-prop: newPassword/set/submit/error; adopts the session through the runtime) and `MfaEnrollGate` (exchanges the challenge, then provides a NESTED auth runtime context scoped to the enroll access token so the pair's existing `TotpSetup`/`PasskeyRegistration` work unchanged against the limited session; `complete(tokens)` commits the full session via `session.setTokens`).
  - **default**: `ForcedPasswordChangeCard` and `MfaEnrollPanel` (AuthPanel canon — self-themed via ConfigProvider + tokens-antd; the enroll panel dresses the setup journeys directly because the status-driven security managers read endpoints outside the enroll-only surface). `AuthPanel`'s password path renders both intermediates inline.
  - **i18n**: `auth.forcedChange.*`, `auth.mfaEnroll.*` (en + ru).
  - Contract pin: stapel-auth → v0.12.0 (`08caee5`), regen'd together.

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
