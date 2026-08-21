/**
 * `@stapel/shell-react/default` — the antd-skinned `<AppShell/>`. A separate
 * entry point (same convention as `auth-react`/`profiles-react`'s
 * `/default`) so a consumer who renders their own chrome around
 * `resolveNav`'s output never pulls `antd`/`react-router` into their bundle.
 *
 * ```tsx
 * import { resolveNav } from "@stapel/shell-react";
 * import { AppShell } from "@stapel/shell-react/default";
 * const nav = resolveNav(installedManifests, overridesFile);
 * <Route element={<AppShell nav={nav} mode="light" />}>...child routes...</Route>
 * ```
 *
 * Two chromes live here, siblings rather than modes of one another:
 * `<AppShell/>` (Sider/Drawer — the signed-in app) and `<PublicShell/>` (top
 * bar + browse bar — the public storefront). They share `resolveNav`, the
 * icon table, the nav `Menu` and the theme config; they share no geometry.
 */
export { AppShell } from "./AppShell.js";
export type { AppShellProps } from "./AppShell.js";
export { PublicShell } from "./PublicShell.js";
export type { PublicShellProps } from "./PublicShell.js";
