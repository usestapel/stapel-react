/**
 * @stapel/calendar-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from this package's own `package.json`, and writes
 * `packages/calendar-react/nav-manifest.json` plus this package's slice of the
 * monorepo's root aggregate. `resolveNav` (`@stapel/shell-react`) turns that
 * aggregate plus a host's overrides into the tree a shell renders and a
 * container mounts routes from.
 *
 * ── Two entries, and the parent is one of them ────────────────────────────
 *
 * `calendar.month` is TOP level and declares no parent, so it cannot be
 * orphaned — the defect two other pairs hit by hanging a screen off an
 * `admin.root` nobody declares (`resolveNav` drops such an entry silently, and
 * the screen has no door). `calendar.availability` nests under it, inside this
 * same manifest, so the pair either contributes both or neither.
 *
 * ── There is no separate agenda entry ─────────────────────────────────────
 *
 * The agenda is not another screen: it is what `<Calendar>` renders when the
 * box it is in is too narrow for a month grid. Giving it its own route would
 * put two doors in the menu that lead to the same component, and one of them
 * would be a lie on a desktop.
 */
import type { NavEntry } from "@stapel/core";

/** This pair's own top-level entry, and the parent of everything under it. */
export const CALENDAR_ROOT_ID = "calendar.month";

export const navEntries: readonly NavEntry[] = [
  {
    id: CALENDAR_ROOT_ID,
    labelKey: "calendar.view.heading",
    icon: "ClockCircleOutlined",
    route: { path: "calendar" },
    component: { export: "Calendar", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 40,
  },
  {
    id: "calendar.availability",
    labelKey: "calendar.availability.heading",
    icon: "OrderedListOutlined",
    route: { path: "availability" },
    component: { export: "AvailabilityPane", subpath: "default" },
    placement: { level: "submenu", parentId: CALENDAR_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 10,
  },
];
