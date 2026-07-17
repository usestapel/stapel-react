---
"@stapel/auth-react": minor
---

Adds `<QrDeviceLinkPanel/>` (`@stapel/auth-react/default`) — a default-skin `session_share` QR device-handoff panel: a logged-in device generates a QR immediately on trigger (no extra "generate" click), shows a live TTL countdown, silently auto-refreshes on a backend-reported `expired`, and surfaces `fulfilled`/`rejected`/error status with retry. Built entirely on the pair's existing `QrLogin` headless flow (`qrGenerate`/`qrStatus`/`qrReject`) — no new backend surface. `allowUnauthenticatedScanner` defaults to `true` (stapel-auth 403s an unauthenticated `session_share` scan unless this is set, since the whole point of this component is an unauthenticated phone scanning to sign in). Generic by design, not settings-bound: title/subtitle/`redirectUrl` are props so a host can place it on e.g. a live call/meeting page (its primary intended use — "continue this on your phone") as well as a security-settings "add a device" card, where it ships alongside `SessionsList`/`TotpManager`/`PasskeysManager`/`OAuthLinks`.

The underlying `createQrLoginFlow`/`QrLogin` headless layer gains a `cancel()` action alongside the existing `dispose()`: `dispose()` keeps its current client-only stop behavior (no server call — existing callers like the sign-in `QrPanel` are unaffected), while `cancel()` best-effort calls the existing `/qr/{key}/reject/` endpoint before disposing, so a user-initiated cancel actually invalidates the pending key server-side instead of just going quiet locally.

`i18n/ru` size-limit budget raised 8kB→8.5kB for the new copy.
