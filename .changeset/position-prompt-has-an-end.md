---
"@stapel/geo-react": minor
---

"Use my position" stops spinning when the browser never answers

The picker's own locate button calls `getCurrentPosition` directly, and the
Geolocation spec stops the `timeout` clock while the permission decision is
pending — so a prompt that is dismissed rather than answered fires NEITHER
callback, ever. Measured on a live classified deployment: the button stayed in
"Finding you…" for the whole of a 30s watch (60 probes at 500ms) over a live
map it could have used all along. `@stapel/core`'s `usePermission` has carried
that bound for four releases; this button does not go through it.

`useBrowserPosition` now arms its own deadline — `decisionTimeoutMs`, default
20s, the same number and for the same reason. When it expires the control
resolves into an honest state instead of a spinner: the Permissions API is
asked whether the site is simply blocked, and the outcome is `denied` if it
says so and `timeout` otherwise, both of which already have a sentence and a
retry beside the button. 20s and not 10s so that a genuinely slow fix fails as
`code: 3` first — "we could not place you" and "you never answered" stay two
different sentences.

A callback that arrives after the deadline (or after a second `locate()`) no
longer repaints the control, and the deadline is cleared on unmount.
