---
"@stapel/core": minor
"@stapel/tokens-antd": minor
"@stapel/geo-react": minor
---

Refusing geolocation is no longer a dead end in the location field.

A night e2e run on a live storefront found that a seller who declines the
location pre-prompt cannot file a listing at all: "Not now" closed the sheet
and left the field empty, the next tap re-asked the same question, and a
browser prompt that was opened and never answered left the sheet spinning in
its `prompt` arm forever. Without a place, Publish never enables.

The measured cause of the last one is a spec detail worth writing down: the
Geolocation spec stops `getCurrentPosition`'s `timeout` clock while the
permission decision is pending, so a prompt nobody answers calls **neither**
callback, ever — verified in Chromium, where an ungranted context never
settles while the same call under a granted permission rejects with `code: 3`
after exactly its `timeout`.

- **`usePermission`** now always settles. `request()` waits for the attempt,
  but gives up once `decisionTimeoutMs` (new option, default 20s) has passed
  *and* the Permissions API still reports the question open — so an unanswered
  prompt hands control back instead of hanging, while a slow GPS fix the
  person actually allowed is never cut short.
- **`PermissionSheet`** renders `fallback` in every arm but `granted`, not
  only when the capability is blocked. The way around was previously offered
  only after a refusal had been recorded, which left "Not now" — the answer
  the sheet's own way out invites — as the one answer with nothing behind it.
- **`LocationField`** treats every exit from the sheet as the door it always
  documented: dismissing it, or an unanswered browser prompt, opens the picker
  on the IP centre. The position only ever centred the map. The pre-prompt is
  also asked once per field rather than on every tap.
