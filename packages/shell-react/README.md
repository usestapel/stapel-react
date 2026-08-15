# @stapel/shell-react

Scripted-fullstack navigation shell (Phase 1 lib-side core, owner directive: from
OSS libs, one scripted command with **no LLM** produces a working navigated
fullstack).

## `resolveNav` (root export — pure, no React)

```ts
import { resolveNav } from "@stapel/shell-react";
import navManifest from "../nav-manifest.json"; // pnpm gen:nav's root aggregate

const nav = resolveNav(navManifest.packages, projectOverrides);
```

Merges every installed `@stapel/<pair>-react`'s nav-manifest, applies a
project's per-entry `menuVisible`/`order` overrides, sorts, nests
`placement.level: "submenu"` entries under their `parentId`, and filters to
only the entries that resolve visible. Runs identically at scaffold codegen
time (baking a default `stapel.nav.json`) and at runtime in the shipped app
(re-applying the project's live override file) — see the module doc in
`src/headless/resolveNav.ts` for the exact algorithm.

## `<AppShell/>` (`/default` subpath — antd + react-router)

```tsx
import { AppShell } from "@stapel/shell-react/default";

<Route element={<AppShell nav={nav} mode="light" />}>
  {/* the consumer's own nested <Route>s render into AppShell's <Outlet/> */}
</Route>;
```

A responsive antd `Layout`: a `Sider` + `Menu` at desktop width, a hamburger
`Drawer` at phone/tablet width (`@stapel/core`'s `useBreakpoint`). Theme comes
from `toAntdThemeConfig(mode)` (`@stapel/tokens-antd`) — the same call
`@stapel/auth-react`'s `AuthPanel` makes. The shell does not own the router:
`nav` is already-resolved data, and the consumer wires its own route tree
around `<AppShell/>`.

## `<ThemeModeControl/>` (`/theme` subpath — plain DOM, no antd, no CSS file)

```tsx
import { ThemeModeControl, useThemePreference } from "@stapel/shell-react/theme";

// `preference` is whatever the host treats as the source of truth — a
// profile field, a store, local state.
useThemePreference(preference);
<ThemeModeControl value={preference} onChange={save} />;
```

Three states, not two: **light**, **dark**, and **follow the system** (sun /
moon / half-disc, the Django-admin idiom). `system` is a rule, not a colour —
it resolves to one of the other two and keeps resolving — so the mark stays on
the half-disc whatever it currently resolves to, and the half-disc's accessible
name names that resolution (`"Match system (Dark)"`). Buttons and inline
`currentColor` SVG, coloured through `--stapel-*` custom properties with
fallbacks, so a Tailwind host with no antd and no `tokens.css` renders it
correctly too.

`applyThemePreference()` is the single writer: it stamps `data-theme` (the
canon `@stapel/tokens-antd`'s `resolveThemeMode()` reads), the Tailwind `dark`
class (`darkClasses: []` opts out) and `color-scheme` in one call, so a host
cannot end up half themed. It never touches the backend — persisting the
choice is the host's, through whatever profile client it already owns.
`THEME_PREFERENCE_STORAGE_KEY` is published for the host's pre-paint boot
script, which runs before any bundle and so cannot import this module.
