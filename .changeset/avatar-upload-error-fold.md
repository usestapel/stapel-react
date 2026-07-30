---
"@stapel/profiles-react": minor
---

`useAvatarUpload` no longer lies about its error. `catch (e) { setError(e as
StapelApiError) }` typed EVERY failure as a Stapel error — a network fault, an
origin answering HTML, a transport rethrowing the raw envelope all landed in
`error` with `undefined` for `.code`/`.status` at runtime, so a consumer's
`error.code`-driven message silently rendered nothing. It now folds through
`toStapelApiError(e)`, so `error` is always a real `StapelApiError`: a genuine
backend envelope keeps its code/status, and a transport fault gets
`stapel.transport.failed` + status `0` instead of a fabricated shape. The
`AvatarUploadBag.error` type (`StapelApiError | null`) is unchanged.

Requires the fold, so the `@stapel/core` peer floor moves to `>=0.9.0 <1.0.0`.
