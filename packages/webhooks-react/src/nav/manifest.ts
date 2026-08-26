/**
 * @stapel/webhooks-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * ── One entry, and it is a SUBMENU under settings ─────────────────────────
 *
 * Webhooks are developer settings: a thing you configure about your own
 * account or workspace, like sessions and two-factor. So the entry nests under
 * `profiles.settings` exactly as `auth.security` does, rather than claiming a
 * top-level slot in a product's main navigation — a marketplace whose primary
 * nav reads "Listings · Messages · Webhooks" has told every visitor that a
 * developer feature is a third of the product. `resolveNav` degrades
 * gracefully when no `profiles.settings` is installed (the entry is dropped,
 * nothing throws), which is the right failure for a host that does not ship a
 * settings area at all.
 *
 * The delivery log has NO entry of its own on purpose: it is per-subscription
 * and is reached from a row, so a route to it would be a route with no way to
 * know which webhook it was about.
 *
 * `icon` must be a name the shell's registry knows
 * (`shell-react/src/default/icons.tsx`); `ApiOutlined` — the natural glyph for
 * an integration surface — is NOT in it, and that registry is another
 * package's file. `AppstoreOutlined` is the closest name the registry does
 * resolve; adding `ApiOutlined` is filed in REQUESTS-webhooks-react.md.
 *
 * Adding the next screen: ship the component from `./default`, add an entry
 * here, then `pnpm gen:nav` — never hand-edit `nav-manifest.json`.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "account.webhooks",
    labelKey: "webhooks.nav.webhooks",
    icon: "AppstoreOutlined",
    route: {
      path: "webhooks",
    },
    component: {
      export: "WebhooksSettingsPane",
      subpath: "default",
    },
    placement: {
      level: "submenu",
      parentId: "profiles.settings",
    },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 40,
  },
];
