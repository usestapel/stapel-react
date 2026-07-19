/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`, `frontend-core-
 * architecture` Ф1). `scripts/gen-nav-manifest.mjs` reads `navEntries`
 * below, stamps `package`/`version` from THIS package's own `package.json`
 * (never hand-copied here — a version bump must not require touching this
 * file), and emits `packages/auth-react/nav-manifest.json` plus this
 * package's slice of the root aggregate.
 *
 * Two entries:
 *  - `auth.login` — the sign-in screen. `menuVisibleDefault: false`: it is
 *    the unauthenticated redirect target, never a menu item a signed-in user
 *    clicks.
 *  - `auth.security` — the composed `<SecuritySettings/>` page (see
 *    `../default/SecuritySettings.tsx`), nested under `profiles.settings`'s
 *    submenu. `resolveNav` degrades this entry gracefully (drops it, no
 *    throw) if a host installs auth-react without profiles-react.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "auth.login",
    labelKey: "auth.nav.login",
    icon: "LoginOutlined",
    route: { path: "/login" },
    component: { export: "AuthPanel", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: false,
    order: 0,
  },
  {
    id: "auth.security",
    labelKey: "auth.nav.security",
    icon: "SafetyCertificateOutlined",
    route: { path: "security" },
    component: { export: "SecuritySettings", subpath: "default" },
    placement: { level: "submenu", parentId: "profiles.settings" },
    menuVisibleDefault: true,
    requiresAuth: true,
    order: 10,
  },
];
