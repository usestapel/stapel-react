# @stapel/shell-react

## 0.3.0

### Minor Changes

- 2d22564: New `/theme` subpath: `<ThemeModeControl/>`, the three-state theme switch every
  app in the fleet was about to write for itself.

  Light / dark / follow-the-system, in the Django-admin idiom (sun, moon,
  half-disc). `system` is a rule, not a colour: the mark stays on the half-disc
  whatever it resolves to, and the half-disc's accessible name carries the
  resolution (`"Match system (Dark)"`), so "following the system, currently dark"
  never reads the same as "pinned to dark".

  Plain DOM and inline `currentColor` SVG — no antd, no react-router, no CSS file
  to import — because the two hosts that need it render nothing alike (one is
  Tailwind + radix with no antd at all). 1.6 kB, isolated from the package root,
  which stays pure for scaffold-time `resolveNav`.

  `applyThemePreference()` is the single writer: `data-theme` (the canon
  `@stapel/tokens-antd`'s `resolveThemeMode()` reads), the Tailwind `dark` class
  and `color-scheme` in one call, so a host cannot end up half themed. It
  persists nothing to a backend — the host keeps owning its profile field —
  but does cache the choice under the published
  `THEME_PREFERENCE_STORAGE_KEY` for a pre-paint boot script.

## 0.2.1

### Patch Changes

- a8bd3f4: Raise the `@stapel/core` peer floor to the version that actually exports what each package imports.

  `@stapel/workspaces-react` 0.15.0 shipped declaring `>=0.12.0` while importing
  `LoadState`, which core did not export until 0.13.0. npm installed it happily;
  the host's typecheck then failed on a type the package's own `.d.ts` referenced
  and the host could not resolve. Nine packages were wrong the same way — most by
  a wider margin (`recordings-react` allowed 0.3.0).

  Nothing here could have caught it by building: in this monorepo every package
  compiles against the workspace core, always the newest one, so a declared floor
  is never the version anything is compiled against. `pnpm check:peer-floors` now
  reads each package's imports from `@stapel/core`, asks core's own tagged history
  which release first exported each name, and fails when the floor is older —
  wired into CI **and** the publishing path, since a gate only on the merge path
  does not stop a release.

  Also invalidates the workspace audit query after an invite, a role change and a
  removal: the history sits beside the roster and an admin who acts on one expects
  to see it in the other. Its key is its own root, so the members invalidation did
  not reach it.

## 0.2.0

### Minor Changes

- b97fdef: New package: the scripted-fullstack navigation shell (Ф1 lib-side core). Root export `resolveNav(installed, overridesFile)` is pure (no React, no antd, no react-router) — it merges installed pairs' nav-manifests, applies a project's `menuVisible`/`order` overrides, sorts, nests `submenu` entries under their `parentId` (dropping an orphaned parent gracefully, never throwing), and filters to visible entries. The same function runs at scaffold codegen time and at shipped-app runtime. The `/default` subpath ships `<AppShell/>`: a responsive antd `Layout` (`Sider`+`Menu` at desktop, hamburger `Drawer` at phone/tablet, via `@stapel/core`'s `useBreakpoint`) around a `react-router` `<Outlet/>` — the shell renders the resolved nav but does not own the router. Themed via `toAntdThemeConfig` (`@stapel/tokens-antd`), same call `AuthPanel` makes.
