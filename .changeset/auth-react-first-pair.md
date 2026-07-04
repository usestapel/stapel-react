---
"@stapel/auth-react": minor
---

New package: headless React auth flow pair for stapel-auth (frontend-standard
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
