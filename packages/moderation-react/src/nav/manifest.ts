/**
 * @stapel/moderation-react's contribution to the scripted-fullstack navigation contract
 * (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from this package's own `package.json`, and writes
 * `packages/moderation-react/nav-manifest.json` plus this package's slice of the
 * monorepo's root aggregate. `resolveNav` (`@stapel/shell-react`) is what
 * turns that aggregate plus a host's override file into the tree a shell
 * renders and a container mounts routes from.
 *
 * ── Four entries, and the one control that has none ───────────────────────
 *
 * `<ReportButton>` is deliberately absent: it is a SLOT other pairs embed
 * (a listing card, a review, a chat message menu), not a screen, and a nav
 * entry for it would build a route to a control with no target.
 *
 * Every entry names a component that EXISTS, which is the whole rule: an entry
 * naming a component that does not passes the generator's structural
 * validation and fails at the CONTAINER's import, two repositories away from
 * the mistake.
 *
 * `surface` is DECLARED, not left to the `requiresAuth ? "member" : "public"`
 * derivation. `admin.moderation` is `member` on purpose: the axis cannot say
 * "staff", so the console names that refusal on the screen (the gdpr-react
 * precedent) rather than pretending the router can filter it.
 *
 * `icon` must be a name the shell's registry knows
 * (`shell-react/src/default/icons.tsx`). The spec asks for `FlagOutlined` /
 * `SafetyOutlined` / `StopOutlined`; the registry has none of the three, so
 * these use the two it does have and the ask is filed for the shell's owner.
 *
 * Adding the next screen: ship the component from `./default`, add an entry
 * here, then `pnpm gen:nav` — never hand-edit `nav-manifest.json`.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "moderation.policy",
    labelKey: "moderation.nav.policy",
    icon: "SafetyCertificateOutlined",
    route: { path: "policy" },
    component: { export: "PolicyDisclosurePane", subpath: "default" },
    placement: { level: "top" },
    // A footer link, not a menu item: the host places it where its terms and
    // privacy pages already are. DSA Art. 15 asks for it to be findable, not
    // for it to compete with the shop.
    menuVisibleDefault: false,
    requiresAuth: false,
    surface: "public",
    order: 90,
  },
  {
    id: "account.appeals",
    labelKey: "moderation.nav.appeals",
    icon: "AuditOutlined",
    route: { path: "appeals" },
    component: { export: "AppealPanel", subpath: "default" },
    placement: { level: "submenu", parentId: "account.root" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 40,
  },
  {
    id: "admin.moderation",
    labelKey: "moderation.nav.moderation",
    icon: "SafetyCertificateOutlined",
    route: { path: "moderation" },
    component: { export: "ModerationQueue", subpath: "default/admin" },
    placement: { level: "submenu", parentId: "admin.root" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 20,
  },
  {
    id: "admin.moderation-appeals",
    labelKey: "moderation.nav.appeals",
    icon: "AuditOutlined",
    route: { path: "moderation-appeals" },
    component: { export: "AppealsQueue", subpath: "default/admin" },
    placement: { level: "submenu", parentId: "admin.root" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 21,
  },
];
