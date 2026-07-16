---
"@stapel/auth-react": minor
---

Contract pin bumped to stapel-auth 0.6.0: `capabilities()` is now a fully generated response (`AuthCapabilities`) instead of hand-transcribed — it gains `methods` (per-method `placement`/`order`/`interaction`/`icon_svg`) and `otp` (server-authoritative `email_code_length`/`phone_code_length`/`totp_code_length`/`ttl_seconds`/`resend_cooldown_seconds`). The `/oauth/links/` list/link/unlink trio also ships in this contract.

Default-skin tuning (owner directive): alt sign-in methods picked from the bottom icon row or the "More ways to sign in" overflow menu now open in a dialog (Modal on tablet/desktop, a bottom Drawer "sheet" on phone via `@stapel/core`'s `useBreakpoint`) — fixing a bug where an overflow pick set `active` to a channel absent from the tab strip's own `items`, so nothing rendered. Main tabs are capped at 3 and never grow from an overflow/bottom pick. SSO and OAuth are never a tab (SSO gets a real domain-lookup dialog; OAuth renders as direct per-provider redirect buttons). Channel `placement`/`interaction`/`icon_svg` come from the backend's `capabilities().methods` via `computeZones`/`resolveInteraction`/`methodIconSvg`, falling back to a fixed default placement table on older backends (email/phone → main, password/magic_link → overflow, sso/oauth/qr/passkey → bottom — stapel-auth's own defaults). "Magic link" is renamed "Email link" (ru: "Ссылка на почту"). The email/phone OTP step now auto-submits once every `Input.OTP` cell is filled (no "Confirm" button) — digit count from `capabilities().otp` (fallback 6) — and clears + refocuses on a wrong code; the same server-authoritative length now backs `TotpManager`'s and `PasswordChangePanel`'s OTP inputs too.

Ships the pair's first security-settings default-skin components (`@stapel/auth-react/default`): `SessionsList`, `TotpManager`, `PasskeysManager`, `PasswordChangePanel`, `OAuthLinks`. `OAuthLinks` (`useOAuthLinks`/`useLinkOAuth`/`useUnlinkOAuth`) is real end to end for read + unlink; its "Connect" action and `PasskeysManager`'s "Add" both take a thin host binding (`getAccessToken`/`webauthnCreate`) for the browser-side ceremony this pair cannot perform itself, same boundary as the existing WebAuthn TODO.

Adds `usePhoneCountryDefault` (in `model/`, not `headless/` — it's a plain hook) — an opt-in (default OFF) IP→country phone-prefix hook; not wired into `AuthPanel` automatically.

`size-limit` budgets raised (12kB→13.5kB main, 7kB→8kB ru locale) for the new UI copy.
