# @stapel/shell-react

## 0.2.0

### Minor Changes

- b97fdef: New package: the scripted-fullstack navigation shell (Ф1 lib-side core). Root export `resolveNav(installed, overridesFile)` is pure (no React, no antd, no react-router) — it merges installed pairs' nav-manifests, applies a project's `menuVisible`/`order` overrides, sorts, nests `submenu` entries under their `parentId` (dropping an orphaned parent gracefully, never throwing), and filters to visible entries. The same function runs at scaffold codegen time and at shipped-app runtime. The `/default` subpath ships `<AppShell/>`: a responsive antd `Layout` (`Sider`+`Menu` at desktop, hamburger `Drawer` at phone/tablet, via `@stapel/core`'s `useBreakpoint`) around a `react-router` `<Outlet/>` — the shell renders the resolved nav but does not own the router. Themed via `toAntdThemeConfig` (`@stapel/tokens-antd`), same call `AuthPanel` makes.
