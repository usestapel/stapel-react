/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`). `scripts/gen-nav-
 * manifest.mjs` reads `navEntries` below, stamps `package`/`version` from
 * THIS package's own `package.json`, and emits
 * `packages/notifications-react/nav-manifest.json` plus this package's
 * slice of the root aggregate.
 *
 * TWO entries, because this pair has two surfaces and they belong in different
 * places:
 *
 *  - the FEED is a top-level page behind a bell. It used to route a `<Card>`
 *    titled "Recent notifications" as if it were one; it now routes
 *    `<NotificationsPage/>`, which is page-shaped.
 *  - PUSH is a settings surface, so it sits as a `submenu` under
 *    `profiles.settings` — the placement `auth-react` gives `auth.security`,
 *    for the same reason.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "notifications.feed",
    labelKey: "notifications.nav.feed",
    icon: "BellOutlined",
    route: { path: "notifications" },
    component: { export: "NotificationsPage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    order: 20,
  },
  {
    id: "notifications.push",
    labelKey: "notifications.nav.push",
    icon: "BellOutlined",
    route: { path: "settings/push" },
    component: { export: "PushSettingsPane", subpath: "default" },
    placement: { level: "submenu", parentId: "profiles.settings" },
    menuVisibleDefault: true,
    requiresAuth: true,
    order: 30,
  },
];
