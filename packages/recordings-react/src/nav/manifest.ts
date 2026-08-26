/**
 * @stapel/recordings-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below and writes this
 * package's `nav-manifest.json` plus its slice of the monorepo aggregate;
 * `resolveNav` (`@stapel/shell-react`) turns that into the tree a shell renders
 * and a container mounts routes from.
 *
 * ── Two member screens and ONE public one ────────────────────────────────
 *
 * The share view is the entry that matters here: `surface: "public"`, because
 * the link token in the path IS the credential and the page must render for a
 * visitor who has never signed in. Deriving the surface from `requiresAuth`
 * would get this right by accident today and wrong the first time somebody
 * edits that flag for an unrelated reason, so it is declared.
 *
 * `recordings.detail` and `share.view` are not menu items (`menuVisibleDefault:
 * false`): both are reached from something — a row, a link someone was sent —
 * and a menu entry pointing at a route with no id in it would land on nothing.
 *
 * ── Icons ────────────────────────────────────────────────────────────────
 *
 * `shell-react`'s registry has no audio glyph, so these use the nearest names
 * it can resolve rather than shipping a blank fallback square. Adding
 * `AudioOutlined` / `ShareAltOutlined` to that registry is in this pair's
 * REQUESTS; the ids and routes do not move when it lands.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "recordings.list",
    labelKey: "recordings.list.heading",
    icon: "FolderOpenOutlined",
    route: { path: "recordings" },
    component: { export: "RecordingsList", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 40,
  },
  {
    id: "recordings.detail",
    labelKey: "recordings.detail.heading",
    icon: "ProfileOutlined",
    route: { path: ":recordingId" },
    component: { export: "RecordingDetailPane", subpath: "default" },
    placement: { level: "submenu", parentId: "recordings.list" },
    menuVisibleDefault: false,
    requiresAuth: true,
    surface: "member",
    order: 41,
  },
  {
    id: "share.view",
    labelKey: "recordings.share.heading",
    icon: "AppstoreOutlined",
    route: { path: "share/:linkToken" },
    component: { export: "SharedRecordingView", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: false,
    surface: "public",
    order: 90,
  },
];
