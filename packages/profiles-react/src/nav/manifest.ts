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
 * `../../auth-react/src/nav/manifest.ts`) — and, until this wave, the ONLY
 * entry this pair declared. Four screens have doors now:
 *
 *  - `profiles.language` / `profiles.notifications` — the two finished
 *    settings screens that had no route at all. They are ALSO composed into
 *    `<ProfileSettings/>` by default, so a host picks: one page with three
 *    sections (leave these submenu entries hidden, or pass
 *    `showLanguage={false}` / `showNotifications={false}` and use them).
 *  - `profiles.connections` — the caller's own followers / following /
 *    blocked lists. Nine backend operations reached no control before it.
 *  - `profiles.public` — `/u/:userId`, the "look at somebody" screen. Not a
 *    menu item (nobody navigates to it by choice): it is the address a roster
 *    row, a chat header or a review byline links to, which is why it needs a
 *    declared route rather than every host inventing one.
 *
 * ICONS: `profiles.connections` wants `TeamOutlined` and `profiles.language`
 * wants `GlobalOutlined`; neither is in `@stapel/shell-react`'s registry yet
 * (an unregistered name renders as a generic square), so both borrow a
 * registered neighbour until it is. Requested in the wave-B REQUESTS file.
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
  {
    id: "profiles.language",
    labelKey: "profiles.nav.language",
    // Wants GlobalOutlined — see the icons note above.
    icon: "MessageOutlined",
    route: { path: "language" },
    component: { export: "LanguageSettings", subpath: "default" },
    placement: { level: "submenu", parentId: "profiles.settings" },
    // Off by default: `<ProfileSettings/>` composes this screen, so a host
    // that changes nothing gets it as a section rather than as a second menu
    // item pointing at the same controls. `resolveNav`'s override file turns
    // it on for a host that prefers three pages.
    menuVisibleDefault: false,
    requiresAuth: true,
    order: 20,
  },
  {
    id: "profiles.notifications",
    labelKey: "profiles.nav.notifications",
    icon: "BellOutlined",
    route: { path: "notifications" },
    component: { export: "NotificationPreferences", subpath: "default" },
    placement: { level: "submenu", parentId: "profiles.settings" },
    // Same reason as `profiles.language`.
    menuVisibleDefault: false,
    requiresAuth: true,
    order: 30,
  },
  {
    id: "profiles.connections",
    labelKey: "profiles.nav.connections",
    // Wants TeamOutlined — see the icons note above.
    icon: "HeartOutlined",
    route: { path: "connections" },
    component: { export: "ConnectionsPage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    order: 91,
  },
  {
    // The address a roster row / a chat header / a review byline links to.
    // `:userId` is a REQUIRED prop of the component (`<PublicProfilePage
    // userId=…>`), the same contract categories-react's `<CategoryPage slug=…>`
    // uses — this pair carries no router, so the scaffold wires the segment.
    id: "profiles.public",
    labelKey: "profiles.nav.public_profile",
    icon: "ProfileOutlined",
    route: { path: "/u/:userId" },
    component: { export: "PublicProfilePage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    // A session is not required to look at a public profile: the endpoint is
    // AllowAny, and `relationship_status` simply comes back null for an
    // anonymous reader (the relationship controls then state their own reason
    // rather than pretending to work).
    requiresAuth: false,
    surface: "public",
    order: 92,
  },
];
