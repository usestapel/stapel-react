---
"@stapel/auth-react": minor
---

The passkeys settings row is about a credential, not about signing in.

It showed a name and a green button whose label is the SIGN-IN button's copy
in every locale — offered to someone who is, necessarily, already signed in.
That came from the add-journey's success step reusing `auth.ui.submit` as its
dismiss button; it says `auth.sec.passkeys.done` now, which is what the button
does.

The row itself answers what a credential-management row has to answer: the
device name, WHAT the credential lives in (read from `transports[]` — the
fingerprint reader in this laptop, a security key, a phone over Bluetooth: three
very different answers to "can I use this right now", and none of them was on
screen), when it was added, and when it was last used — or, honestly, that it
never has been, which is how a person spots the key they enrolled and lost.
"Add a passkey" becomes "Add another" once one exists.

Removal confirms in the fleet's `SkinDialog` instead of a `Popconfirm`: a
popover anchored to a small link button renders off-viewport on a phone with
Ok/Cancel below the touch minimum, and this particular Ok permanently deletes
a sign-in credential.

"Add" is now BLOCKED, with its reason printed beside it as text, where the
browser has no WebAuthn and no binding is injected. The screen always knew that
fact; it used to spend it only after the click, from inside a ceremony that can
never complete.

RENAME IS DELIBERATELY ABSENT and not faked: the contract is `GET /passkey/`,
`POST /passkey/register/{begin,complete}/` and `DELETE /passkey/{id}/`, so
`device_name` is writable exactly once, at register-complete. A rename button
here would be the same defect as the sign-in button it replaced. The backend
needs one additive route — `PATCH /passkey/{id}/ {"device_name": …}` — and the
row is shaped so that adding it is a button, not a redesign.

Also in this package: `AuthPanel`, `QrDeviceLinkPanel` and `TotpManager`'s two
dialogs now render through `@stapel/tokens-antd/skin`'s `SkinDialog`, so they
are bottom sheets on a phone. The TOTP pair mattered most — a QR code and a
six-digit field are the worst possible content for a centred desktop modal on a
phone.
