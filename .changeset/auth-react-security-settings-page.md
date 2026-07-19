---
"@stapel/auth-react": minor
---

`SecuritySettings` was six widgets stacked in one `<Card>` with `<Divider>`s — no page title, no per-section structure, each widget's own heading a bare `Typography.Title` that vanished if a host ever mounted a widget outside that composed page (the exact failure mode a downstream consumer hit). Rebuilt as a real settings page:

- Every `default/security/*` widget (`SessionsList`, `TotpManager`, `PasskeysManager`, `PasswordChangePanel`, `OAuthLinks`, `QrDeviceLinkPanel`) now self-wraps in its **own `<Card title=…>`** — the section heading moved into the Card title, so each widget reads as a distinct settings section even mounted bare, not just inside `SecuritySettings`.
- **New `EmailChangePanel`/`PhoneChangePanel`** (default-skin, `default/security/`), both thin `channel`-parametrized wrappers around a new shared `AuthenticatorChangePanel` — built entirely on the EXISTING `<AuthenticatorChange>` headless flow (instant: request-old → verify-old → request-new → verify-new) and the existing `useDelayedChangeStatus`/`useCancelDelayedChange` hooks, no flow rebuilt. Shows the masked current email/phone, a primary "Change email/phone" action (instant, default), and a secondary "No access to your old email/phone?" path into the delayed (14-day) strategy via the new `useInitiateDelayedChange` mutation. A pending delayed change — on mount, or freshly started — short-circuits straight to a pending-status banner ("Changing to … in N days", with a cancel action) instead of the change form.
- **New `AuditLogPanel`** (default-skin) — re-adds the security audit log UI dropped during the ironmemo port, over the existing `useAuditLog` query: an antd `List` with loading/empty/error states and "Load more" pagination.
- `SecuritySettings` is now `Typography.Title level={2}` "Security" + a subtitle, then the widgets in grouped, titled sections: Contact details (email/phone change) → Password → Two-factor authentication (TOTP, passkeys) → Devices & sessions (sessions, QR device link) → Connected accounts (OAuth) → Security log (audit).
- New i18n keys (en + ru) for all of the above; `EmailChangePanel`/`PhoneChangePanel`/`AuditLogPanel`/`AuthenticatorChangePanel` exported from `@stapel/auth-react/default`; `useInitiateDelayedChange` now exported from the main entry (it existed on the API client already — `changeDelayedInitiate` — just had no query hook wired to it).
- `size-limit` budgets bumped (14 KB → 15 KB main entry, 8.5 KB → 9.5 KB `i18n/ru`) to fit the new keys; both stay well under their new ceilings.

TOTP "change" (as opposed to enable/disable) stays out of scope — it needs a new backend endpoint, tracked separately.
