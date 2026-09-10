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
 * <Route element={<AppShell nav={nav} />}>...child routes...</Route>
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
// The public chrome's own GEOMETRY, so a host that pins anything under the
// header states the offset once and reads it from the component that owns it.
// `HEADER_HEIGHT_VAR` is the same two numbers as a custom property on the
// shell's root, for the half of a deployment that is a stylesheet.
export {
  DEFAULT_HEADER_SCROLL_THRESHOLDS,
  HEADER_HEIGHT_DESKTOP,
  HEADER_HEIGHT_PHONE,
  HEADER_HEIGHT_VAR,
  PUBLIC_HEADER_CLASS,
  PUBLIC_SHELL_CLASS,
  PUBLIC_SHELL_STYLE_HREF,
  SCROLL_SENTINEL_HEIGHT,
  headerScrollThresholds,
  publicShellCss,
} from "./PublicShell.js";
export type { HeaderScrollThresholds } from "./PublicShell.js";
// WHERE A ROUTE LANDS — both chromes call this, and it is exported so a host
// that arranges its own chrome around an `<Outlet/>` states the same rule
// rather than a fifth version of it. `<AppShell scrollRestoration={false}>` /
// `<PublicShell scrollRestoration={false}>` opt out.
export { useRouteScrollReset } from "./routeScroll.js";
// The two host-resolved brand slots `<PublicShell/>` falls back to when the
// host passes neither `brand` nor `footer` and a `<SiteProvider>` is mounted
// (multibrand spec, frontend decision). Exported on their own so a host that arranges its own
// chrome still gets one wordmark and one legal line, not two implementations.
// The theme switch both chromes render by default (`themeControl`). Exported
// on its own so a host arranging its own chrome — or putting the switch in a
// settings screen as well — mounts the same self-managing control rather than
// re-wiring `readStoredThemePreference`/`useThemePreference` by hand.
export { ShellThemeControl } from "./ShellThemeControl.js";
export type { ShellThemeControlProps } from "./ShellThemeControl.js";
export { SiteBrand } from "./SiteBrand.js";
export type { SiteBrandProps } from "./SiteBrand.js";
export { SiteLegalFooter } from "./SiteLegalFooter.js";
export type { SiteLegalFooterProps } from "./SiteLegalFooter.js";
export {
  NavDock,
  dockEntries,
  dockRenders,
  DOCK_MAX_DESTINATIONS,
  DOCK_HEIGHT,
  DOCK_CLEARANCE,
  DOCK_CLASS,
  DOCK_STYLE_HREF,
  dockGlassCss,
} from "./NavDock.js";
export type { NavDockProps } from "./NavDock.js";
