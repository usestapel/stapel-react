# @stapel/shell-react

Scripted-fullstack navigation shell (Ф1 lib-side core, owner directive: from
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
