/**
 * @stapel/tasks-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from this package's own `package.json`, and writes
 * `packages/tasks-react/nav-manifest.json` plus this package's slice of the
 * monorepo's root aggregate. `resolveNav` (`@stapel/shell-react`) turns that
 * aggregate plus a host's override file into the tree a shell renders.
 *
 * ── Two entries: a list and a board ────────────────────────────────────────
 *
 * `tasks` is the menu item — the boards list, the only tasks screen a person
 * can reach without already knowing an id.
 *
 * `tasks/:boardId` is a navigation TARGET, not a menu item, which is why it
 * declares `menuVisibleDefault: false` (the same treatment `listings.detail`
 * and `search.results` get): a parameterized route has no single destination to
 * put in a sidebar. The container's route element passes the matched param to
 * `KanbanBoard`'s `boardId` prop, exactly as it passes `:id` to
 * `ListingDetailPane` — the pair imports no router and knows no `useParams`.
 * `KanbanBoard` renders a designed "no board selected" state when the prop is
 * absent, so a container that forgets the wiring gets a sentence rather than a
 * blank screen.
 *
 * `surface` is DECLARED, not left to the `requiresAuth ? "member" : "public"`
 * derivation: a screen that later gains `requiresAuth` for an unrelated reason
 * must not silently drop out of a public container's tree.
 *
 * `icon` must be a name shell-react's registry knows
 * (`shell-react/src/default/icons.tsx`). The build spec asked for
 * `ProjectOutlined`; that glyph is NOT in the registry today, so these entries
 * use `ProfileOutlined` / `AppstoreOutlined` (both registered) and the addition
 * is filed in `SCRATCH/wave-b/REQUESTS-tasks-react.md` — an unknown name
 * renders a generic square with no error anywhere, which is worse than a
 * slightly generic glyph.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "tasks.boards",
    labelKey: "tasks.nav.boards",
    icon: "ProfileOutlined",
    route: { path: "tasks" },
    component: { export: "BoardsPane", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 30,
  },
  {
    id: "tasks.board",
    labelKey: "tasks.nav.board",
    icon: "AppstoreOutlined",
    route: { path: "tasks/:boardId" },
    component: { export: "KanbanBoard", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: true,
    surface: "member",
    order: 31,
  },
];
