# @stapel/auth-react — MODULE.md

Headless auth flow pair for stapel-auth (frontend-standard §2/§5). First
instance of the framework's **flow-machine** pattern; later `-react` pairs copy
it. Layers: `api/` (typed client over `@stapel/core`) → `model/` (runtime,
session, query hooks) → `flows/` (state machines) → `headless/` (render props)
→ `i18n/` (key bundle).

## Documentation source: the generated SA-doc (do not duplicate prose)

Per docs/flow-system.md §5, the flow source of truth is `flows.json`
(`generate_flow_docs`). It fans out to five projections; this pair consumes two
of them — the **SA-doc** (people) and the **flow machines** (code) — plus the
typed client from the OpenAPI projection. The prose for each documented flow
lives in the **generated SA-doc**, not here:

- Index: [`stapel-auth/docs/flows/en/README.md`](../../../stapel-auth/docs/flows/en/README.md)
  · [RU](../../../stapel-auth/docs/flows/ru/README.md)
- [`auth.password_login`](../../../stapel-auth/docs/flows/en/auth.password_login.md)
  · [`auth.passwordless_login`](../../../stapel-auth/docs/flows/en/auth.passwordless_login.md)
  · [`auth.step_up_verification`](../../../stapel-auth/docs/flows/en/auth.step_up_verification.md)

## Client & machines are generated projections (drift-gated)

- **Client types** — `api/types.ts` is a thin adapter over the generated
  `components["schemas"]` in `@stapel/core` (`pnpm gen:api`, drift gate
  `pnpm gen:api:check`). It re-exports the generated schemas under the pair's
  names and applies only four documented corrections (enum-discriminant repair,
  array-element typing, present-but-optional, untyped-string literal repair)
  where the codegen under-describes the runtime. No parallel hand-written
  response shapes.
- **Flow registry** — `flows/generated/flows.gen.ts` is scaffolded from
  `flows.json` (`pnpm gen:flows`, drift gate `pnpm gen:flows:check`). The three
  documented flows bind their machine `id` to the canonical registry id, so the
  analytics funnel (`flow.<id>.<step>`) and the endpoint contract match the
  backend flow. `test/flowsContract.test.ts` proves the coupling (id binding +
  "machine HTTP surface ⊆ registry endpoints"). Machines for journeys the
  backend has not annotated yet keep local ids until they appear in `flows.json`.
- **E2E** — the generated Gherkin `.feature` projection (docs/flow-system.md §3)
  is **not yet wired**: `arch-flow-gherkin` (the step-implementation generator)
  is still blocked. When it lands, generated `.feature` files run against the
  same `flows.json`; until then the vitest happy-path suites (MSW-mocked) are the
  behavioural gate. See "Follow-up" at the end.

## The `createFlowMachine` pattern (reusable primitive)

A flow is a tiny state container whose state is a discriminated union keyed by
`step`. `createFlowMachine({ id, initial, analytics })` gives every flow three
things for free:

- **Typed transitions** — `to(next)` swaps state (immutable snapshots) and
  notifies React via `useFlow` (`useSyncExternalStore`).
- **Human-wait vs async steps** — a resting step waits for user input (`to`);
  an async step goes through `run(pending, task, { resolve, reject })`, which
  parks in `pending`, awaits, then transitions on the result. `run` **never
  throws** — rejections fold into an error state, so hosts render errors
  instead of catching them. `run` is **staleness-guarded** (an epoch counter
  bumped on every `to`): if a newer transition happens while the task is in
  flight — double-submit, cancel, navigate, challenge expiry — the late result
  is dropped, never clobbering the newer state nor running its resolve/reject
  side effects (analytics still fires). This guard lives in the primitive so
  every future pair inherits it.
- **Auto-instrumentation** — each transition emits `flow.<id>.<step>` started;
  each `run` emits `completed`/`failed` for its pending step
  (analytics-standard §1.2). Funnels exist without hand-written tracking.

Each flow is a factory `createXxxFlow(deps) → { machine, ...actions }`. Deps are
`{ api, analytics?, onAuthenticated? }`. Copy this shape for new pairs.

## Flows & headless components

Flows marked **[flows.json]** bind to a canonical registry id and are
drift-gated against the backend flow; the rest keep local ids until the backend
annotates them.

| Journey (auth-sa.md) | Flow factory | Headless | Status |
|---|---|---|---|
| Email/Phone OTP §1–2 **[flows.json: `auth.passwordless_login`]** | `createOtpFlow` | `<PasswordlessLogin>` | **full** |
| Password login + TOTP branch §3/§11 **[flows.json: `auth.password_login`]** | `createPasswordLoginFlow` | `<PasswordLogin>` | **full** |
| Password change §4 | `createPasswordChangeFlow` | `<PasswordChange>` | **full** |
| Password reset §5 | `createPasswordResetFlow` | `<PasswordReset>` | **full** |
| Step-up verification §11 **[flows.json: `auth.step_up_verification`]** | `createVerificationController` | `<VerificationChallenge>` | **full** (passkey factor thin) |
| TOTP setup §11 | `createTotpSetupFlow` | `<TotpSetup>` | **full** |
| OAuth token exchange §7 | `createOAuthFlow` | — (+ `authUrls().oauthAuthorize`) | **full** |
| Sessions §12 | model hooks/mutations | — | **full** |
| Token refresh §13 | `AuthSession.onAuthRefresh` | — | **full** |
| QR login/session-share §8 | `createQrLoginFlow` | `<QrLogin>` | **full** (polling) |
| Magic link §15 | `createMagicLinkFlow` | `<MagicLink>` | **full** (request side) |
| Anonymous §6 | `createAnonymousFlow` | `<AnonymousSession>` | **full** |
| Authenticator change (instant) §9 | `createAuthenticatorChangeFlow` | `<AuthenticatorChange>` | **full** (delayed = CRUD hooks) |
| SSO discovery §18 | `createSsoFlow` | `<SsoDiscovery>` | **full** (redirect handoff) |
| Passkeys §17 | `createPasskeyRegistrationFlow` / `createPasskeyLoginFlow` | `<PasskeyRegistration>` / `<PasskeyLogin>` | **flow complete, WebAuthn binding THIN** |

### Thin-WebAuthn TODO (honest scope)

Passkeys and the `passkey` verification factor model the full
begin→ceremony→complete journey and surface the server `options` /
`session_key`. The **single browser step** — `navigator.credentials.create()` /
`.get()` — is **not** implemented here. Provide it one of two ways:

1. **Inject a binding** — pass `webauthnCreate` / `webauthnGet` (to the flow,
   the `<Passkey*>` components, or `createAuthRuntime({ webauthnGet })`); the
   flow auto-drives the ceremony.
2. **Drive it manually** — read the `awaitingCredential` / `awaitingAssertion`
   state's `options`, run the ceremony yourself, call `submitCredential` /
   `submitAssertion` / `submitPasskey`.

No "no credentials" heuristics — per auth-sa.md §19.6 that leak works against
the privacy property; show the single copy key `auth.passkey.no_credentials`.

## Verification challenge lifecycle

Exactly one challenge is live at a time. The controller holds the core
request's awaited resolver, so it must always release it:

- **Success** → `settle({ retry: true, token })`; core replays with
  `X-Verification-Token`.
- **Cancel** → `settle({ retry: false })`; the original 403 propagates.
- **Expiry** → the envelope's `expires_at` schedules an auto-release: an
  abandoned modal (user walks away, never cancels) resolves `{ retry: false }`
  instead of hanging the core `fetch` forever — and because the resolver is
  cleared, subsequent challenges are handled rather than declined (no wedge).
- **Factor initiate failure** → a 404 (challenge gone) ends the whole challenge
  (`unavailable` + settle `retry:false`); any other failure (a 423-locked or
  invalid factor, network) returns to the **picker** carrying the error, so a
  different, still-valid factor remains choosable.

## Model hooks

Queries: `useCapabilities`, `useMe`, `useSecurityStatus`, `usePasswordMethods`,
`useSessions`, `usePasskeys`, `useAuditLog`, `useDelayedChangeStatus`,
`useSsoLookup`. Mutations (with invalidation): `useLogout`, `useRevokeSession`,
`useRevokeOtherSessions`, `useConfirmSession`, `useRemovePasskey`,
`useDisableTotp`, `useCancelDelayedChange`. Keys are namespaced under `["auth"]`
(`authQueryKeys`).

## Session & persist policy

`AuthSession` (via `createAuthRuntime`) holds `{ user, tokens, status }`,
exposes `getAccessToken` / `onAuthRefresh` wired into the client, and rotates
the refresh token on 401. `error.401.refresh_revoked` → `onTeardown("revoked")`
(hard logout); any other refresh failure → `"expired"`; explicit
`logout()` → `"logout"`. A recursion guard ensures the refresh request's own
401 does not re-enter refresh. Session persists `{ user, tokens }` to core's
`PersistStorage` (IndexedDB→localStorage) under `stapel-auth:session`; query
cache persistence is per-user via core's `setPersistUser` — call
`purgePersistedCache()` from `onTeardown` for GDPR-grade logout.

## Extension points (fork-free, frontend-standard §7)

- **Client injection** — every flow/hook uses the client from
  `createAuthRuntime` (host-built); a divergent backend injects its own
  generated client into the same machines.
- **Steps/guards** — flows are plain factories; wrap or replace actions.
- **Headless layer** — render props are replaceable by definition; shadcn-copy
  them into the app.
- **i18n** — override any key via core's `loadLocale`, or statically by
  registering a host bundle AFTER the pair's (registration order = override
  priority, later wins per key — i18n-shipping.md §3). Layering inside one
  locale: generated en floor → pair polish/UI copy → pair locale bundle
  (`@stapel/auth-react/i18n/ru`: generated from the backend's
  `translations/errors.ru.json` catalog + hand-written ru UI copy; it registers
  the en floor UNDER ru so a missing key degrades to English, never a raw key)
  → host bundle last. The ru subpath is opt-in and stays out of the main entry
  (size-limit budget + module-graph test in `test/i18nRu.test.ts`).

## Ambiguities / conflicts surfaced from auth-sa.md

1. **Legacy step-up — decided (arch-stepup-unification): NOT in this pair.**
   §11 documents a legacy `POST /totp/step-up/` + `X-Step-Up-Token` path
   (§19.4's interceptor handled `403 error.403.step_up_required`). The
   unification decision is a **server-side bridge**: the backend maps any
   legacy step-up requirement onto the standard verification envelope, so the
   client implements **one** contract. auth-react therefore ships **only** the
   envelope flow (`error.403.verification_required` → `verification` object),
   matching `@stapel/core`'s interception seam. The legacy `X-Step-Up-Token`
   client path is an **invariant absence** — do not reintroduce it; a legacy
   endpoint that still emits the old 403 is a backend-bridge bug, not a client
   gap.
2. **QR error codes diverge.** The §8 status polling uses a `{status}` body
   (`rejected`/`expired`) while the Error reference lists `error.409.qr_*` /
   `error.403.qr_*` HTTP errors. The flow treats the status body as
   authoritative for polling and surfaces HTTP errors as `error` state.
3. **OAuth redirect (option A) shapes.** §7 option A + §19.1 imply a
   `/app/oauth/callback` frontend route and a `/totp-challenge` alias; those are
   **host routing** concerns (the backend sets cookies), so auth-react provides
   only `authUrls().oauthAuthorize` and the token-exchange flow (option B), not
   the callback route.
4. **Magic-link / SSO landings** (`/login?...` params, §15/§18.2) are backend
   redirects to host routes; auth-react provides the `safeNextPath` /
   `safeScanRedirect` guards (§19.2) but the route components are app-layer.
5. **Capabilities `password` under registration** is documented but no
   password-registration endpoint exists in §1–18; treated as display-only.

## Default skin (`/default` subpath) — sign-in + security settings

`@stapel/auth-react/default` ships two families of Ant Design components over
the SAME headless layer above — see each file's own doc comment for the
owner-directive tuning history (channel placement/modal rework, OTP
auto-submit, the Waylot-referenced responsive alt-method sheet):

- **`<AuthPanel/>`** (`default/AuthPanel.tsx`) — the sign-in screen. Channel
  zones (`main`/`bottom`/`overflow`) come from `default/channels.ts`'s
  `computeZones`, driven by the backend's `capabilities().methods` (stapel-auth
  ≥0.6.0 — per-method `placement`/`order`/`interaction`/`icon_svg`,
  `AuthMethodInfo` in `api/types.ts`) with a fixed default-placement-table
  fallback for older backends (matches stapel-auth's own defaults:
  email/phone → main, password/magic_link → overflow, the rest → bottom).
- **Security-settings components** (`default/security/`) — `SessionsList`,
  `TotpManager`, `PasskeysManager`, `PasswordChangePanel`, `OAuthLinks`. Each
  wraps EXISTING query/mutation hooks and headless flows; `OAuthLinks`
  (`useOAuthLinks`/`useLinkOAuth`/`useUnlinkOAuth`, `AuthApi.oauthLink*`) is
  the pair's newest real surface — `/oauth/links/` list/link/unlink, part of
  the same 0.6.0 contract. Its "Connect" action and `PasskeysManager`'s "Add"
  both carry a THIN host binding (`getAccessToken`/`webauthnCreate`) for the
  browser-side ceremony this pair cannot perform itself — same boundary as
  the existing Thin-WebAuthn TODO below.

## Follow-up

- **Generated `.feature` E2E** awaits `arch-flow-gherkin` (step-implementation
  generator, currently blocked). Wiring is a drop-in against the same
  `flows.json` once it lands; the vitest happy-path suites hold the line until
  then.
- **Verification preferences** endpoints (`GET`/`PUT /verification/preferences/`)
  appear in the `auth.step_up_verification` flow but are not yet surfaced on
  `AuthApi` (the pair covers the challenge write-path; preferences are optional
  CRUD).
- **`TotpManager`'s disable dialog** ships authenticator-code and backup-code
  disable only; SMS-based disable (`_TOTPDisableByOTP`, needs
  `totpDisableOtpRequest` wired to a code-request step first) is a follow-up.
- **`PasswordChangePanel`** renders `"password"`/`"email"`/`"phone"` tabs from
  `usePasswordMethods()`; a `"totp"` entry is informational only — the
  headless `PasswordChange` flow's OTP channel is email/phone-only, so there
  is no verification path for it to drive yet.

## Status

**NOT released** — Opus-authored first instance; awaits independent adversarial
review of the pair (fable) before any npm publish (no-Fable protocol).
