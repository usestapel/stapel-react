---
"@stapel/auth-react": patch
---

Close the third visual review's blockers in the default skin: the flagship page renders, the panel family is on the token layer, and the showcase stops shipping debug cards.

**The composed security page drew nothing.** `demo/fixtures.ts` answered
`GET /password/methods/` with a bare array where the contract sends
`{ methods, has_password }`, so `PasswordChangePanel` reached `matchList`'s
ready arm with `undefined`, threw inside render, and React unmounted the whole
tree — an all-white `SecuritySettings` page (and `change-password`) with
nothing in the console. The fixture matches the contract now, every
`mapLoad` projection over an optional array degrades to the designed empty
state instead of throwing, and `test/demos.test.tsx` asserts what a reviewer
looks for on **every variant of every demo**, not just "it mounted": ink on
the canvas, no raw i18n key in the rendered text, no console error.

**One seam, thirteen dark-mode failures.** `TotpManager`, `QrDeviceLinkPanel`
and the four `*ChangePanel`s never wrapped themselves in `SkinTheme`, so they
painted a light card on a dark document and shipped antd's stock `#1677ff`
beside the project's indigo. The token layer now lives inside the new
`SecurityCard` primitive that every security and console widget wears, so a
widget cannot forget it; the `<Badge color="blue">` backup-codes chip is a
token-neutral `Tag`; and the two hand-rolled `toLocaleDateString()` helpers
are `@stapel/core`'s `useFormat` (no more `9/1/2026`).

`SecurityCard` also replaces antd's `<Card title extra>` header, whose title is
`nowrap` + ellipsis: `Active se…`, `Two-factor au…` and the passkeys header
painting over its own rule are all gone, the header wraps instead. Audit rows
(both the security log and the operator console) moved onto `SecurityListRow`,
so the `Unrecognized activity` badge occupies grid space beside the timestamp
instead of floating over it, and connected-accounts rows stop breaking
`Goo`/`gle` mid-word.

**A refusal is not a fault.** A 403 on any of the four operator consoles now
renders a stated refusal — padlock, explanation, no `Try again` — and gates the
page's own primary action through `GatedButton` with the reason beside it,
instead of a generic alert under a live `Issue a key`. The audit filters use
the design system's `DatePicker` rather than a bare `<input type="date">`.

**Stories.** 13 of the 15 legacy harness demos are deleted — every screen they
stood in for has a real skin story, now declared through `covers:` (the two
whose headless component has no skin yet, `PasswordReset` and
`VerificationChallenge`, stay and are filed as a gap). The
`authenticator-change` story mounted the email panel and photographed
identically to it; it now mounts both channels, which is the claim it makes.
Byte-identical sibling variants are seeded apart or removed, the MFA-enrol
happy path answers `POST /totp/setup/` instead of rendering its own failure,
and the demo fixtures use error codes that exist in the bundle — `error.500.server`
and `error.503.unavailable` were invented, so the refusal states printed the raw key.

Copy: a channel label interpolated into a sentence takes a new inline form
(`auth.ui.channel_{email,phone}_inline`), so "Your old Phone has been notified"
reads "Your old phone…" and `Current Email:` / `Change Email` are sentence case;
step-up scopes render `Wallet withdraw`, never `wallet.withdraw`. New keys ship
in en/ru/es.
