/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`). `scripts/gen-nav-
 * manifest.mjs` reads `navEntries` below, stamps `package`/`version` from
 * THIS package's own `package.json`, and emits
 * `packages/notifications-react/nav-manifest.json` plus this package's
 * slice of the root aggregate.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "notifications.feed",
    labelKey: "notifications.nav.feed",
    icon: "BellOutlined",
    route: { path: "notifications" },
    component: { export: "NotificationFeedList", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    order: 20,
  },
];
