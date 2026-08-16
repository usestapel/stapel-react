---
"@stapel/auth-react": minor
---

The `login_request` QR sign-in had no second half.

The pair renders a `login_request` QR on the sign-in screen and polls it, and
stapel-auth's `/qr/{key}/scan/` redirects a signed-in scanner to
**`/qr-confirm?key=…`** — a path hardcoded in the backend. Nothing in this pair
rendered at that path, listed it in the nav manifest, or documented it. Every
host therefore resolved it through its own catch-all: the phone landed on the
home page looking like a success, `POST /qr/{key}/confirm/` was never sent, and
the device showing the code polled a key nobody would ever fulfil. Neither
device raised anything — no error was possible, because nothing failed; a route
simply was not there.

- `<QrConfirmPanel/>` (`@stapel/auth-react/default`) is that screen: it states
  what is being approved, approves (`useConfirmQrLogin`) or declines
  (`useRejectQrLogin` — a decline is *sent*, so the waiting device is answered
  instead of left staring at a code for the full TTL), and states a refusal
  from either call. It reads `?key=` off the address when the host does not
  pass one, so the nav scaffold's prop-free mount works.
- `navEntries` now declares `auth.qr_confirm` at `/qr-confirm`, so a host that
  mounts the pair's routes gets the screen the backend already redirects to.
- `useConfirmQrLogin` / `useRejectQrLogin` are exported for hosts with their
  own visuals.

Separately, the sign-in QR channel no longer fails in silence. `QrPanel` mapped
every failure onto `<QRCode status="expired">` and nothing else — a slightly
greyed square, indistinguishable from a code that merely aged out, with no
message and no console line. `error.403.qr_device_mismatch` (polling a key this
browser did not mint) is the case that made it unmissable: waiting cannot fix
it, and waiting was the only thing the panel suggested. It now states the
reason and offers a retry, the way its sibling `QrDeviceLinkPanel` always has.

And a delivered grant the session refuses is no longer announced as a success.
`login_request` fulfilment hands the polling device a bare token pair;
`AuthSession.setTokens` answers `null` when the server rejects it, and
`createQrLoginFlow` used to discard that answer — it settled `fulfilled`, the
panel drew a success, and the person was not signed in and was told nothing.
`onAuthenticated` may now report its outcome, and a `null` settles
`error` with `auth.qr.error.session_not_adopted`.
