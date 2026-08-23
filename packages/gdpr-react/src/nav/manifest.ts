/**
 * @stapel/gdpr-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from this package's own `package.json`, and writes
 * `packages/gdpr-react/nav-manifest.json` plus this package's slice of the
 * monorepo's root aggregate. `resolveNav` (`@stapel/shell-react`) is what
 * turns that aggregate plus a host's override file into the tree a shell
 * renders and a container mounts routes from.
 *
 * ── Two entries, and neither id starts with `gdpr.` ───────────────────────
 *
 * The convention is `"<module>.<screen>"`, and these are `account.privacy` and
 * `admin.privacy` (design §3). Nobody looks for "delete my account" under a
 * regulation's initials: a person looks in their account settings, and an
 * operator looks in the admin area. The id names the MENU an entry belongs to,
 * because that is what an id is for in a tree assembled from many packages;
 * the package that owns the code is already recorded beside it in the
 * manifest.
 *
 * `account.root` and `admin.root` are CONTAINER-owned parents this pair does
 * not declare (the `@stapel/listings-react` / `@stapel/video-react`
 * precedent). `resolveNav` DROPS an orphaned submenu entry instead of
 * throwing, so a host that installs this pair without an admin area gets a
 * smaller menu rather than a broken build.
 *
 * ── The axis cannot say "staff", so the SCREEN says it ────────────────────
 *
 * `surface` has two values (`public` | `member`). `admin.privacy` is
 * `"member"` — the truest available answer — and the DSAR queue behind it
 * answers `error.403.forbidden` to a signed-in person who is not staff. The
 * pane names that refusal (`isStaffOnly`) rather than rendering an empty
 * operations table, and the entry stays visible by default: a hidden door
 * teaches nobody anything, while a door that explains itself teaches an
 * operator that they are signed in as the wrong account.
 *
 * `account.privacy` is `member` for the ordinary reason — every endpoint
 * behind it is `IsAuthenticated`. Note what is NOT here: the anonymous
 * `<DsarForm variant="anonymous"/>` belongs on a PUBLIC /privacy page that a
 * host routes itself, outside the authenticated shell this manifest describes.
 * Declaring it as a `public` nav entry would put "make a data-protection
 * request" in a signed-in person's menu twice, once pointing at a form that
 * asks them to retype the email address the session already knows.
 */
import type { NavEntry } from "@stapel/core";

/** The container-owned account section this pair's member screen hangs from. */
export const ACCOUNT_ROOT_ID = "account.root";
/** The container-owned admin area the operations screen hangs from. */
export const ADMIN_ROOT_ID = "admin.root";

export const navEntries: readonly NavEntry[] = [
  {
    id: "account.privacy",
    labelKey: "gdpr.privacy.heading",
    icon: "SafetyCertificateOutlined",
    route: { path: "privacy" },
    component: { export: "PrivacyPane", subpath: "default" },
    placement: { level: "submenu", parentId: ACCOUNT_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 90,
  },
  {
    id: "admin.privacy",
    labelKey: "gdpr.admin.heading",
    icon: "AuditOutlined",
    route: { path: "privacy" },
    component: { export: "PrivacyAdminPane", subpath: "default/admin" },
    placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 40,
  },
];
