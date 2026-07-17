---
"@stapel/auth-react": patch
---

Bumps the `stapel-auth` contract pin (`contract-pins.json`) from v0.6.0 to v0.7.5 and regenerates `api/generated/schema.ts`, `i18n/generated/errors.*`, `manifest.json`, and `llms.txt` against it. This removes the orphaned `totp_step_up` operation/types/error (`TOTPStepUp`, `TOTPStepUpResponse`, `error.403.step_up_required`) that had drifted into the generated output from a locally-ahead checkout — the backend's v0.7.0 release scrubbed the legacy `X-Step-Up-Token` surface entirely (superseded by the unified `/verification/` step-up flow), and this regen catches auth-react's generated contract up to that removal. Also picks up v0.7.1-0.7.5's additive changes: QR `generate` now echoes back the accepted `redirect_url`/`allow_unauthenticated_scanner`, and capabilities/login-config gain `mock`/`email_mock`/`phone_mock` flags for mocked OTP delivery.
