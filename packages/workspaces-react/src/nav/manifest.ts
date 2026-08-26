/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`). `scripts/gen-nav-
 * manifest.mjs` reads `navEntries` below, stamps `package`/`version` from THIS
 * package's own `package.json` (never hand-copied here — a version bump must
 * not require touching this file), and emits
 * `packages/workspaces-react/nav-manifest.json` plus this package's slice of
 * the root aggregate.
 *
 * ## The six doors
 *
 *  - `workspaces.list` — the workspace roster (`<WorkspacesPage/>`), under the
 *    container-synthesised `account.root` submenu, next to privacy and
 *    billing. Everything it shows is the caller's own.
 *  - `workspaces.settings` / `.members` / `.invitations` / `.audit` — the four
 *    workspace-scoped admin screens, siblings of the roster under the same
 *    account section, on paths RELATIVE to it (`workspaces/members`, …).
 *  - `workspaces.invite` — the public `/invite/:token` route
 *    (`<InviteAcceptPage/>`). `surface: "public"` and `requiresAuth: false`
 *    because the invitee usually has no account here at all — that is the
 *    entire reason `claim` exists — and the token in the URL is the bearer
 *    secret. `menuVisibleDefault: false`: it is an address a letter sends
 *    somebody to, never a menu item.
 *
 * ## Where the four scoped screens get their workspace (architecture verdict)
 *
 * They do NOT get it from the route. The active workspace is RUNTIME state —
 * the same state the container writes when a person switches workspaces
 * (`WorkspaceSelection.switchTo`) — not a path param of a settings URL, so
 * these entries declare no `:workspaceId` segment and the screens read the
 * selection themselves (`useOptionalWorkspaceSelection`, see
 * `src/default/ActiveWorkspace.tsx`). A host that mounts the same components
 * outside the shell keeps passing `workspaceId` explicitly; the prop stayed,
 * it only became optional.
 *
 * The failure mode that made this a question at all — four doors opening on a
 * screen with no workspace — is answered by the screens rather than by the
 * contract: with no active workspace they render a designed "choose a
 * workspace" state (and "you are not in a workspace yet" for a person who
 * belongs to none), never a blank page and never a crash from a selection
 * provider a shell forgot to wire.
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
    id: "workspaces.settings",
    labelKey: "workspaces.nav.settings",
    icon: "ProfileOutlined",
    route: { path: "workspaces/settings" },
    component: { export: "WorkspaceSettings", subpath: "default" },
    placement: { level: "submenu", parentId: "account.root" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 11,
  },
  {
    id: "workspaces.members",
    labelKey: "workspaces.nav.members",
    icon: "UserOutlined",
    route: { path: "workspaces/members" },
    component: { export: "MembersManager", subpath: "default" },
    placement: { level: "submenu", parentId: "account.root" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 12,
  },
  {
    id: "workspaces.invitations",
    labelKey: "workspaces.nav.invitations",
    icon: "MessageOutlined",
    route: { path: "workspaces/invitations" },
    component: { export: "InvitationsPane", subpath: "default" },
    placement: { level: "submenu", parentId: "account.root" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 13,
  },
  {
    id: "workspaces.audit",
    labelKey: "workspaces.nav.audit",
    icon: "AuditOutlined",
    route: { path: "workspaces/audit" },
    component: { export: "AuditTrailPane", subpath: "default" },
    placement: { level: "submenu", parentId: "account.root" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 14,
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
