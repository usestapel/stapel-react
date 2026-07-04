# @stapel/auth-react

## 1.0.0

### Minor Changes

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

  Not released — Opus-authored first instance, awaits independent adversarial
  review.

### Patch Changes

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
