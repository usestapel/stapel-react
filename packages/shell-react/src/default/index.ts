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
// The two host-resolved brand slots `<PublicShell/>` falls back to when the
// host passes neither `brand` nor `footer` and a `<SiteProvider>` is mounted
// (multibrand spec, frontend decision). Exported on their own so a host that arranges its own
// chrome still gets one wordmark and one legal line, not two implementations.
export { SiteBrand } from "./SiteBrand.js";
export type { SiteBrandProps } from "./SiteBrand.js";
export { SiteLegalFooter } from "./SiteLegalFooter.js";
export type { SiteLegalFooterProps } from "./SiteLegalFooter.js";
export {
  NavDock,
  dockEntries,
  DOCK_MAX_DESTINATIONS,
  DOCK_HEIGHT,
  DOCK_CLEARANCE,
  DOCK_CLASS,
  DOCK_STYLE_HREF,
  dockGlassCss,
} from "./NavDock.js";
export type { NavDockProps } from "./NavDock.js";
