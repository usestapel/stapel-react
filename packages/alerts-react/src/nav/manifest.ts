/**
 * `@stapel/alerts-react`'s contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from this package's own `package.json`, and writes
 * `packages/alerts-react/nav-manifest.json` plus this package's slice of the
 * monorepo's root aggregate. `resolveNav` (`@stapel/shell-react`) turns that
 * aggregate plus a host's override file into the tree a shell renders and a
 * container mounts routes from.
 *
 * ── Two entries, both under the admin area ────────────────────────────────
 *
 * `admin.root` is a CONTAINER-owned parent this pair does not declare (the
 * `@stapel/gdpr-react` / `@stapel/moderation-react` precedent): stapel-tools
 * synthesises it whenever an installed pair hangs a staff screen off it.
 * `resolveNav` DROPS an orphaned submenu entry instead of throwing, so a host
 * that installs this pair without an admin area gets a smaller menu rather
 * than a broken build.
 *
 * ── The axis cannot say "staff", so the SCREEN says it ────────────────────
 *
 * `surface` has two values (`public` | `member`), and every route behind these
 * entries is `IsStaffUser`. `member` is the truest available answer, and the
 * door stays visible by default: `<IssuesFeed>` names the 403 by code
 * (`isAlertsStaffOnly`) instead of drawing an empty triage table. A hidden
 * door teaches nobody anything; an empty table teaches the wrong thing —
 * "nothing is broken" is the one sentence an error tracker must never say by
 * accident.
 *
 * ── The detail is a route, not a menu item ────────────────────────────────
 *
 * `admin.alerts-issue` mounts `<IssueDetail>` at `:issueId` under the feed.
 * Nobody navigates to one issue from a menu — they arrive from a row, or from
 * an `alerts:<issue-id>` reference in a commit message, which is the whole
 * reason the id is stable. So it is `menuVisibleDefault: false`: the scaffold
 * builds the route and nothing appears in the navigation.
 */
import type { NavEntry } from "@stapel/core";

/** The container-owned admin area these screens hang from. */
export const ADMIN_ROOT_ID = "admin.root";

export const navEntries: readonly NavEntry[] = [
  {
    id: "admin.alerts",
    labelKey: "alerts.nav.feed",
    // The bell is the fleet's alarm glyph and is not taken inside the admin
    // section (`BellOutlined` is notifications' — a MEMBER surface). An
    // operator scanning an admin menu for "what is broken" looks for it.
    icon: "BellOutlined",
    route: { path: "alerts" },
    component: { export: "IssuesFeed", subpath: "default" },
    placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    // Above moderation (20) and privacy (40): when something is on fire it is
    // the first door an operator wants, and a menu is read top down.
    order: 10,
  },
  {
    id: "admin.alerts-issue",
    labelKey: "alerts.nav.issue",
    icon: "AuditOutlined",
    // Relative to the parent's `alerts` segment — the container composes
    // `alerts/:issueId`.
    route: { path: ":issueId" },
    component: { export: "IssueDetail", subpath: "default" },
    placement: { level: "submenu", parentId: "admin.alerts" },
    menuVisibleDefault: false,
    requiresAuth: true,
    surface: "member",
    order: 11,
  },
];
