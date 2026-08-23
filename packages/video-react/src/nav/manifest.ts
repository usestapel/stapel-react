/**
 * @stapel/video-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from this package's own `package.json`, and writes
 * `packages/video-react/nav-manifest.json` plus this package's slice of the
 * monorepo's root aggregate. `resolveNav` (`@stapel/shell-react`) is what
 * turns that aggregate plus a host's override file into the tree a shell
 * renders and a container mounts routes from.
 *
 * ── One entry, and why its id does not start with `video.` ────────────────
 *
 * The convention is `"<module>.<screen>"`, and this one is `admin.usage`
 * (design §2). The screen is not a video screen: nobody navigating an app
 * looks for their team's call time under "Video", they look under the
 * workspace's administration — which is also the only place the
 * `USAGE_MANDATE` behind it is granted. The id names the MENU it belongs to,
 * because that is what an id is for in a tree assembled from many packages;
 * the package that owns the code is already recorded beside it in the
 * manifest.
 *
 * `admin.root` is a CONTAINER-owned parent this pair does not declare — the
 * workspace admin area has no module of its own, exactly as the cabinet does
 * not (`@stapel/listings-react`'s `account.root`). `resolveNav` DROPS an
 * orphaned submenu entry instead of throwing, so a host that installs this
 * pair without an admin area gets a smaller menu rather than a broken build.
 *
 * ── `surface: "member"`, declared, not derived ────────────────────────────
 *
 * The axis has two values (`public` | `member`) and there is deliberately no
 * third "signed in but holds no mandate" surface — the screen for that
 * principal is the landing, which names their position. This entry is
 * `member` and says so explicitly rather than leaning on the
 * `requiresAuth ? "member" : "public"` derivation: a session is not a
 * mandate, and the pane behind this route answers the uniform 404 to a
 * signed-in person who is not an admin of the workspace. It must never
 * silently change surface because someone edited `requiresAuth` for an
 * unrelated reason.
 *
 * A hidden menu item would teach nobody anything, which is why the entry is
 * visible by default and the REFUSAL is explained on the screen ("call usage
 * is not available for this workspace") rather than by the door not existing.
 */
import type { NavEntry } from "@stapel/core";

/** The container-owned top entry this submenu hangs from. A constant so the
 * reference cannot drift, and exported so a container can assert it against
 * its own `stapel.nav.json` override. */
export const ADMIN_ROOT_ID = "admin.root";

export const navEntries: readonly NavEntry[] = [
  {
    id: "admin.usage",
    labelKey: "video.usage.heading",
    icon: "ClockCircleOutlined",
    route: { path: "usage" },
    component: { export: "ScopeUsagePane", subpath: "default" },
    placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 30,
  },
];
