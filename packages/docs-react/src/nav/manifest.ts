/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`).
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from THIS package's own `package.json`, and emits
 * `packages/docs-react/nav-manifest.json` plus this package's slice of the
 * root aggregate.
 *
 * ── Two entries, and why exactly two ──────────────────────────────────────
 *
 * `FileManager` is a full-screen workspace surface and `DocSurface` is a
 * document route: the pair's own README already shows
 * `onOpenDocument={(d) => navigate(d.id)}`, i.e. it assumed a route existed
 * and handed the problem to the host. With no manifest at all, `stapel
 * create --with docs` installed the Django module and wired no frontend —
 * twelve shipped skin components with no door.
 *
 * Nothing else here is a page. `RevisionsModal` is a dialog the file manager
 * owns, the panes (`FolderTreePane`, `DocumentListPane`, `TrashPane`) are
 * PARTS of `FileManager` and swappable through the skin slot registry, and
 * `FileCard` is what `DocSurface` degrades to for a download-only type. A nav
 * entry for any of them would claim a page that does not exist.
 *
 * ── Why the document route is hidden ──────────────────────────────────────
 *
 * `/files/:id` is parameterized: a navigation TARGET, not a menu item — the
 * same treatment `listings.detail` and `search.results` get. It is reached by
 * opening a row in the file manager, never by picking it from a menu, so
 * `menuVisibleDefault: false`.
 *
 * Both entries are `top`-level and require a session: stapel-docs authorizes
 * every route with `IsNotAnonymousUser` plus a workspace mandate, so there is
 * no public half to declare. `surface` is stated EXPLICITLY rather than
 * derived from `requiresAuth`, so an entry that later gains an unrelated flag
 * cannot silently change trees (`core/src/nav.ts`, `navEntrySurface`).
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "docs.files",
    labelKey: "docs.nav.files",
    icon: "FolderOpenOutlined",
    route: { path: "/files" },
    component: { export: "FileManager", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 30,
  },
  {
    id: "docs.document",
    labelKey: "docs.nav.document",
    icon: "ProfileOutlined",
    route: { path: "/files/:id" },
    component: { export: "DocSurface", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: true,
    surface: "member",
    order: 31,
  },
];
