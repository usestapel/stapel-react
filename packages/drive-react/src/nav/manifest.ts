/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`).
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from THIS package's own `package.json`, and emits
 * `packages/drive-react/nav-manifest.json` plus this package's slice of the
 * root aggregate.
 *
 * ── One entry, and why exactly one ────────────────────────────────────────
 *
 * `DriveScreen` IS the product: one route, one screen, everything else inside
 * it. Starred, Recent and Trash are TABS of that screen, not pages — they
 * share its breadcrumb bar, its action sheet and its upload tray, and a nav
 * entry per tab would claim four destinations where a person experiences one.
 * The tray, the action sheet and the thumbnail are parts, swappable through
 * the skin slots; a nav entry for any of them would claim a page that does
 * not exist.
 *
 * ── Why /drive and not /files ─────────────────────────────────────────────
 *
 * `@stapel/docs-react` already owns `/files` (its `FileManager`) and
 * `/files/:id` (its `DocSurface`), and nav ids and routes are globally unique
 * across installed packages. The two surfaces are meant to coexist: a host
 * that installs both gets the desktop-ish file manager AND the phone-first
 * drive, and opening a document from either lands on the docs pair's document
 * route — which is why this package declares no `:id` route of its own.
 *
 * `requiresAuth` is true and `surface` is `member`: stapel-docs authorizes
 * every route with `IsNotAnonymousUser` plus a workspace mandate, so there is
 * no public half to declare. `surface` is stated EXPLICITLY rather than
 * derived from `requiresAuth`, so an entry that later gains an unrelated flag
 * cannot silently change trees (`core/src/nav.ts`, `navEntrySurface`).
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "drive.home",
    labelKey: "drive.nav.drive",
    icon: "FolderOpenOutlined",
    route: { path: "/drive" },
    component: { export: "DriveScreen", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 32,
  },
];
