# @stapel/tokens-antd

## 0.5.0

### Minor Changes

- 3ac8297: fix: the error surface a 500 puts on screen — readable, and in the user's language

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

## 0.4.0

### Minor Changes

- a86ced9: §68 — colour tokens move to a neutral, design-system-agnostic role dictionary (`surface`/`surface-raised`/`surface-sunken`/`surface-overlay`, `text`/`text-muted`/`text-subtle`/`text-on-accent`, `border`/`border-subtle`/`focus-ring`, `brand`/`brand-hover`/`brand-active`/`brand-subtle`, `link`/`link-hover`, and `success`/`warning`/`error`/`info` × `{base, -bg, -border, -on}`). Breaking, shipped as minor per the postmortem versioning law (alpha, no stable consumers frozen on the old names yet):

  - **Old ad-hoc names are gone**: `accent`, `background-*-subtle`, `upperground-*`, `icon-*`, `text-invert`, `overlay`, and the whole L3 component-token tier (`button-primary-bg`, `card-bg`, `card-border`, `link-text`, ...) no longer exist. No compatibility alias layer — the dictionary is flat now: a role name IS the CSS var suffix (`--stapel-<role>`, no more `--stapel-color-<role>` + separate `--stapel-<component>`).
  - **The generator ships as a bin**: `@stapel/tokens` now exposes `stapel-tokens` (package.json `bin`), so a host runs it directly (`npx stapel-tokens --theme ./stapel.theme.json --out ./dir`) instead of vendoring/forking the engine. The engine itself moved from an unpublished `scripts/tokens-lib.mjs` into the published `src/gen/`.
  - **Merge-contract**: a host's `stapel.theme.json` deep-merges OVER `theme.default.json` (`mergeTheme`, unit-tested) — the host wins on every leaf it defines, everything else falls through to the default.
  - **Versioned Tailwind adapters** (owner follow-up, "Tailwind 5 won't break us"): the generator always emits a version-independent stable core (`tokens.css`, plain `--stapel-<role>` vars) plus addressable adapters — `tailwind@4` (default, `@theme`, no RGB) and `tailwind@3` (legacy, RGB triplets + a `theme.extend.colors` config snippet), both owned in the bin so a host never forks either. A future `tailwind@5` is one more adapter, additive.
  - **tokens-antd / tokens-mui** read the new roles directly (`colors["brand"]`, `colors["surface-raised"]`, ...) — the old `bridgeColorRoles` indirection table is gone since the neutral dictionary already speaks the bridges' vocabulary. `tokens-antd` keeps its live-CSS-var read (a host's brand colour flows through even to antd's seed-token derivation) and gains `colorTextTertiary`/`colorBgElevated` mappings (`text-subtle`, `surface-overlay`).

  Not published — versions bumped and changeset queued for the coordinator to publish after acceptance.

### Patch Changes

- Updated dependencies [a86ced9]
  - @stapel/tokens@0.5.0

## 0.3.0

### Minor Changes

- 6ef6c44: Fixed the theme-bridge root cause behind a live report: a deployment's
  customized brand colour never showed up in any default skin, which kept
  rendering Stapel's own stock colour (`#4657d9`) regardless of what the host
  configured.

  `toAntdTheme`/`toAntdThemeConfig` used to resolve every colour role from
  `@stapel/tokens`' compiled-in `colors` snapshot — frozen at THIS package's
  own publish time to `@stapel/tokens`' OWN default theme. A host customizing
  its brand colour does so exactly as `@stapel/tokens`' README prescribes (copy
  `theme.default.json` → `stapel.theme.json`, edit the `ramps`, `pnpm
gen:tokens`) — which regenerates the HOST's own `tokens.css` custom
  properties, never this published package's compiled JS.

  `role()` now reads the live `--stapel-color-<role>` custom property off
  `document.documentElement` at call time (the exact value the host's
  regenerated `tokens.css` sets, already resolved through whichever
  `data-theme` is active) and falls back to the compiled-in default only where
  there is no DOM to read (SSR, tests, a host that never loaded `tokens.css`).
  No API change — same `toAntdTheme(mode)`/`toAntdThemeConfig(mode)` signature;
  every default skin that already wraps itself in
  `<ConfigProvider theme={toAntdThemeConfig(mode)}>` (or a host that does) now
  actually reflects the host's brand colour with zero code changes on their
  end.

## 0.2.0

### Minor Changes

- 48188d9: New package: **`@stapel/tokens-antd`** — the Ant Design leg of the token bridge
  (frontend-guidelines §2.4; owner decision §38 T3). `toAntdTheme(mode)` projects
  `@stapel/tokens` L2 core tokens onto an antd `ConfigProvider` `theme.token`;
  `toAntdThemeConfig(mode)` adds the light/dark algorithm so antd's derived
  neutrals flip too. Pure functions reading the ONE shared role table in
  `@stapel/tokens` (no colour decisions of its own), so it and `@stapel/tokens-mui`
  cannot diverge. `antd` is a peer dependency. Mapping-table tests included.

### Patch Changes

- Updated dependencies [48188d9]
- Updated dependencies [2c22f06]
  - @stapel/tokens@0.4.0
