/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`). `scripts/gen-nav-
 * manifest.mjs` reads `navEntries` below, stamps `package`/`version` from THIS
 * package's own `package.json` (never hand-copied here — a version bump must
 * not require touching this file), and emits
 * `packages/workspaces-react/nav-manifest.json` plus this package's slice of
 * the root aggregate.
 *
 * Two entries, and the reason there are only two:
 *
 *  - `workspaces.list` — the workspace roster (`<WorkspacesPage/>`), under the
 *    container-synthesised `account.root` submenu, next to privacy and
 *    billing. It needs no props: everything it shows is the caller's own.
 *  - `workspaces.invite` — the public `/invite/:token` route
 *    (`<InviteAcceptPage/>`). `surface: "public"` and `requiresAuth: false`
 *    because the invitee usually has no account here at all — that is the
 *    entire reason `claim` exists — and the token in the URL is the bearer
 *    secret. `menuVisibleDefault: false`: it is an address a letter sends
 *    somebody to, never a menu item.
 *
 * `<WorkspaceSettings/>`, `<MembersManager/>`, `<InvitationsPane/>` and
 * `<AuditTrailPane/>` are deliberately NOT declared. Each needs a
 * `workspaceId`, and the nav contract has no way to hand a mounted screen the
 * ACTIVE workspace — `route.path` params reach a component the way
 * `listings.detail`'s `:id` does, but "which workspace am I in" is host state
 * (this pair's own `WorkspaceSelectionProvider`), not a path segment of a
 * settings URL. Declaring them anyway would put four doors in the shell that
 * open on a screen with no workspace. Raised for the nav contract in
 * `SCRATCH/wave-b/REQUESTS-workspaces-react.md`.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "workspaces.list",
    labelKey: "workspaces.nav.workspaces",
    icon: "AppstoreOutlined",
    route: { path: "workspaces" },
    component: { export: "WorkspacesPage", subpath: "default" },
    placement: { level: "submenu", parentId: "account.root" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 10,
  },
  {
    id: "workspaces.invite",
    labelKey: "workspaces.nav.invite",
    icon: "MessageOutlined",
    route: { path: "/invite/:token" },
    component: { export: "InviteAcceptPage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    // A session is NOT needed: the whole point of the claim path is that the
    // invitee has no account yet, and decline went `AllowAny` in 0.27.0.
    requiresAuth: false,
    surface: "public",
    order: 0,
  },
];
