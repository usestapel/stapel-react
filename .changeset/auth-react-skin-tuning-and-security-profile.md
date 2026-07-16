---
"@stapel/auth-react": minor
---

Default-skin tuning (owner directive): alt sign-in methods picked from the bottom icon row or the "More ways to sign in" overflow menu now open in a dialog (Modal on tablet/desktop, a bottom Drawer "sheet" on phone via `@stapel/core`'s `useBreakpoint`) — fixing a bug where an overflow pick set `active` to a channel absent from the tab strip's own `items`, so nothing rendered. Main tabs are capped at 3 and never grow from an overflow/bottom pick. SSO and OAuth are never a tab (SSO gets a real domain-lookup dialog; OAuth renders as direct per-provider redirect buttons). Channel `placement`/`interaction`/`icon_svg` can now come from the backend's plan contract (`LoginCapabilities.plan`, stapel-auth ≥0.6.0) via `computeZones`/`resolveInteraction`, falling back to the old priority-only heuristic on older backends. "Magic link" is renamed "Email link" (ru: "Ссылка на почту"). The email/phone OTP step now auto-submits once every `Input.OTP` cell is filled (no "Confirm" button) — digit count from the backend's `otp_code_length` (fallback 6) — and clears + refocuses on a wrong code.

Ships the pair's first security-settings default-skin components (`@stapel/auth-react/default`): `SessionsList`, `TotpManager`, `PasskeysManager`, `PasswordChangePanel`, `OAuthLinks`. `OAuthLinks` is built against a `/oauth/links/` list/link/unlink surface (`useOAuthLinks`/`useLinkOAuth`/`useUnlinkOAuth`) seen as uncommitted work-in-progress in the stapel-auth sibling while building this — NOT in the currently-pinned contract (`LinkedOAuthAccount` in `api/types.ts` is hand-transcribed, not generated; all three calls 404 until stapel-auth ships and the pin bumps). Its "Connect" action and `PasskeysManager`'s "Add" both take a thin host binding (`getAccessToken`/`webauthnCreate`) for the browser-side ceremony this pair cannot perform itself, same boundary as the existing WebAuthn TODO.

Adds `usePhoneCountryDefault` — an opt-in (default OFF) IP→country phone-prefix hook; not wired into `AuthPanel` automatically.

`size-limit` budgets raised (12kB→13.5kB main, 7kB→8kB ru locale) for the new UI copy.
