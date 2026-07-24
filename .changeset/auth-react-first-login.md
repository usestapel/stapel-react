---
"@stapel/auth-react": minor
---

Org-program wave (spec §E, stapel-auth 0.12.0 contract): login grant + first-login enforcement.

- **api**: `exchangeLoginGrant(grantToken)` (`POST /grant/exchange/` — the workspaces invite-claim seam; adopt the result via the runtime session), `completeForcedPasswordChange({challengeToken, newPassword})` (`POST /password/forced-change/`), `mfaEnrollExchange(challengeToken)` (`POST /mfa/enroll/exchange/` → limited enroll-only session). `passkeyRegisterComplete` now returns `PasskeyRegistered` (passkey + optional full-session `tokens` from an enroll-only session).
- **types**: `FirstLoginChallengeResponse` / `FirstLoginRequires` / `isFirstLoginChallenge` — `LoginResponse` is now a three-way union (`AuthResponse | TOTPChallengeResponse | FirstLoginChallengeResponse`); `MfaEnrollSessionResponse`; `TotpSetupConfirmResponse.tokens`.
- **flows**: `passwordLoginFlow` routes the `FIRST_LOGIN_REQUIRED` intermediates into the new `passwordChangeRequired` / `mfaEnrollRequired` resting steps (same pattern as the TOTP challenge). New `createForcedPasswordChangeFlow` (retry-in-place on a rejected password; chains into the mfa_enroll challenge when both policy flags are set) and `createMfaEnrollFlow` (exchange → enroll → `complete(tokens)`), both under the canonical `auth.first_login` registry id. `TotpSetupState.done` / `PasskeyRegisterState.registered` now carry the enroll-upgrade token pair.
- **headless**: `ForcedPasswordChange` (render-prop: newPassword/set/submit/error; adopts the session through the runtime) and `MfaEnrollGate` (exchanges the challenge, then provides a NESTED auth runtime context scoped to the enroll access token so the pair's existing `TotpSetup`/`PasskeyRegistration` work unchanged against the limited session; `complete(tokens)` commits the full session via `session.setTokens`).
- **default**: `ForcedPasswordChangeCard` and `MfaEnrollPanel` (AuthPanel canon — self-themed via ConfigProvider + tokens-antd; the enroll panel dresses the setup journeys directly because the status-driven security managers read endpoints outside the enroll-only surface). `AuthPanel`'s password path renders both intermediates inline.
- **i18n**: `auth.forcedChange.*`, `auth.mfaEnroll.*` (en + ru).
- Contract pin: stapel-auth → v0.12.0 (`08caee5`), regen'd together.
