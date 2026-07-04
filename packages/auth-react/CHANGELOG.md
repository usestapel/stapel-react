# @stapel/auth-react

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
  + teardown + persistence), namespaced TanStack Query hooks and mutations.
- **headless/** — render-prop components incl. the flagship
  `<VerificationChallenge>` factor UI, plus `<AuthProvider>`.
- **i18n/** — auth-react key bundle registered into core's engine.

Passkeys and the passkey verification factor are flow-complete; the WebAuthn
browser binding is a thin injectable seam (see MODULE.md).

**NOT released** — awaits independent adversarial review.
