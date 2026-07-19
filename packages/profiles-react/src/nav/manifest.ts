/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`). `scripts/gen-nav-
 * manifest.mjs` reads `navEntries` below, stamps `package`/`version` from
 * THIS package's own `package.json`, and emits
 * `packages/profiles-react/nav-manifest.json` plus this package's slice of
 * the root aggregate.
 *
 * `profiles.settings` is the top-level settings entry other pairs' submenu
 * entries nest under (e.g. auth-react's `auth.security`, see
 * `../../auth-react/src/nav/manifest.ts`).
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "profiles.settings",
    labelKey: "profiles.nav.settings",
    icon: "UserOutlined",
    route: { path: "settings" },
    component: { export: "ProfileSettings", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    order: 90,
  },
];
