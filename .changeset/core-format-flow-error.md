---
"@stapel/core": minor
---

Add `formatFlowError`/`useFormatFlowError` — the renderer `toFlowError`'s own doc promised ("the frontend renders `t(code, params)`") but never actually supplied: hosts were left writing `bundle[code] ?? code`, so a bundle miss surfaced a raw, unformatted code to the user. Chain: bundle template (interpolated via the existing `interpolate()`) → the backend's own `message`, but ONLY when its `language` matches the host's current locale → the raw `code` as the last resort. `FlowError`/`StapelApiError` grow optional `message`/`language` fields to carry this (additive); `StapelErrorEnvelope` grows an optional `language` for backends that send one. `I18nEngine` grows `getBundle(locale?)` so `useFormatFlowError` can read the merged dictionary `t()` already resolves against.
