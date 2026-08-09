---
"@stapel/tokens-antd": minor
"@stapel/core": minor
"@stapel/profiles-react": patch
"@stapel/auth-react": patch
"@stapel/notifications-react": patch
"@stapel/workspaces-react": patch
---

fix: the error surface a 500 puts on screen — readable, and in the user's language

Two defects an owner hit behind a backend 500 on a live sandbox, both fixed at
their root rather than at the one alert that showed them.

**The alert was unreadable on a dark deployment.** `@stapel/tokens-antd`'s
`readLiveCssVar` served the host's LIVE `--stapel-*` custom properties for
whatever mode the caller asked for — but those properties resolve through the
document's active `data-theme`, so they are the DOCUMENT's mode, not the
caller's. A default skin defaulting `mode` to `"light"` inside
`<html data-theme="dark">` therefore got antd's LIGHT algorithm (deriving
`--ant-color-error-bg: #fff2f0`, near-white) welded to a LIVE DARK
`--ant-color-text: #f4f5f7` — measured 1.00:1 contrast.

- `resolveThemeMode()` (new export) reads the same `data-theme` attribute
  `@stapel/tokens`' `tokens.css` keys its dark block on. `mode` is now optional
  on `toAntdTheme`/`toAntdThemeConfig` and defaults to it.
- `readLiveCssVar` serves a live value only when the document is in the mode
  being asked for; otherwise the compiled-in default for the REQUESTED mode.
  The bridge can no longer emit a blended theme.
- Every `@stapel/profiles-react` default skin defaults `mode` to
  `resolveThemeMode()` instead of `"light"`, so it self-themes with no host
  wiring. Pass `mode` explicitly to pin a side.

**The alert showed `Request failed with status 500`.** That is
`parseErrorEnvelope`'s own diagnostic for a response with no error envelope (a
Django 500 under `DEBUG=False` returns HTML) — the HTTP client's internals, in
English, on a Russian UI. The one-dialect machinery existed but had no rung a
query/mutation-driven skin could reach, and no catalogue behind the codes core
itself mints.

- `@stapel/core` now ships an error FLOOR (`stapel.http.*`,
  `stapel.transport.failed`, `stapel.error.unknown`) in en and ru, seeded by
  `createI18n` under every locale before any caller bundle — a host wires
  nothing, and any pair or host bundle registered later still wins the key.
- `useErrorText()` (new export) folds ANY thrown value into that dialect in one
  call, which is what a skin holding `error: unknown` needed.
- `formatFlowError` exposes the error's HTTP `{status}` to templates and widens
  core's OWN `stapel.http.<status>` codes to a class-wide `stapel.http.5xx`
  entry. Real backend codes are never widened — two different 404s stay two
  different states.
- Default skins across profiles-react, auth-react, notifications-react and
  workspaces-react now render `useErrorText(...)` instead of `error.message`.
