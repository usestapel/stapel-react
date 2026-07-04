# @stapel/auth-react — MODULE.md

Headless auth flow pair for stapel-auth (frontend-standard §2/§5). First
instance of the framework's **flow-machine** pattern; later `-react` pairs copy
it. Layers: `api/` (typed client over `@stapel/core`) → `model/` (runtime,
session, query hooks) → `flows/` (state machines) → `headless/` (render props)
→ `i18n/` (key bundle).

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
  instead of catching them.
- **Auto-instrumentation** — each transition emits `flow.<id>.<step>` started;
  each `run` emits `completed`/`failed` for its pending step
  (analytics-standard §1.2). Funnels exist without hand-written tracking.

Each flow is a factory `createXxxFlow(deps) → { machine, ...actions }`. Deps are
`{ api, analytics?, onAuthenticated? }`. Copy this shape for new pairs.

## Flows & headless components

| Journey (auth-sa.md) | Flow factory | Headless | Status |
|---|---|---|---|
| Email/Phone OTP §1–2 | `createOtpFlow` | `<PasswordlessLogin>` | **full** |
| Password login + TOTP branch §3/§11 | `createPasswordLoginFlow` | `<PasswordLogin>` | **full** |
| Password change §4 | `createPasswordChangeFlow` | `<PasswordChange>` | **full** |
| Password reset §5 | `createPasswordResetFlow` | `<PasswordReset>` | **full** |
| Step-up verification §11 | `createVerificationController` | `<VerificationChallenge>` | **full** (passkey factor thin) |
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
- **i18n** — override any key via core's `loadLocale`.

## Ambiguities / conflicts surfaced from auth-sa.md

1. **Legacy step-up vs verification envelope.** §11 keeps `POST /totp/step-up/`
   + `X-Step-Up-Token`, while §19.4 says the interceptor currently handles
   `403 error.403.step_up_required` (the legacy path). auth-sa.md itself says
   "new integrations should implement the envelope flow." We implement **only**
   the envelope flow (`error.403.verification_required` → `verification`
   object), matching `@stapel/core`'s interception seam. The legacy
   `X-Step-Up-Token` path is intentionally **not** implemented — flag for review
   if any endpoint still emits it.
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

## Status

**NOT released** — Opus-authored first instance; awaits independent adversarial
review before any npm publish (no-Fable protocol).
