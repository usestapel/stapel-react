import type {
  AuditParams,
  InvitationsParams,
  MembersParams,
} from "../api/types.js";

/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"workspaces"` root so a host can invalidate the whole
 * module or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 */
const ROOT = "workspaces" as const;

export const workspacesQueryKeys: {
  readonly all: readonly ["workspaces"];
  list(): readonly ["workspaces", "list"];
  detail(workspaceId: string): readonly ["workspaces", "detail", string];
  members(workspaceId: string): readonly ["workspaces", "members", string];
  membersAll(): readonly ["workspaces", "members"];
  membersPage(
    workspaceId: string,
    params: MembersParams
  ): readonly ["workspaces", "members", string, MembersParams];
  audit(workspaceId: string): readonly ["workspaces", "audit", string];
  auditPage(
    workspaceId: string,
    params: AuditParams
  ): readonly ["workspaces", "audit", string, AuditParams];
  invitations(workspaceId: string): readonly ["workspaces", "invitations", string];
  invitationsPage(
    workspaceId: string,
    params: InvitationsParams
  ): readonly ["workspaces", "invitations", string, InvitationsParams];
  invitationsInfinite(
    workspaceId: string,
    filters: InvitationsParams
  ): readonly [
    "workspaces",
    "invitations",
    string,
    "infinite",
    InvitationsParams,
  ];
  roles(): readonly ["workspaces", "roles"];
  instance(): readonly ["workspaces", "instance"];
  invitationPreview(
    token: string
  ): readonly ["workspaces", "invitation-preview", string];
} = {
  all: [ROOT],
  list: () => [ROOT, "list"],
  detail: (workspaceId) => [ROOT, "detail", workspaceId],
  // The bare 3-tuple is a valid prefix of membersPage's 4-tuple, so
  // invalidating `members(workspaceId)` (mutations.ts) drops every page.
  members: (workspaceId) => [ROOT, "members", workspaceId],
  /** The workspace's membership history (stapel-workspaces 0.24). Its own
   * root, not a slice of `members`: history is append-only and a member
   * mutation invalidates the ROSTER — the history it also appended to is
   * invalidated deliberately, by naming this key, not as a side effect. */
  audit: (workspaceId) => [ROOT, "audit", workspaceId],
  auditPage: (workspaceId, params) => [ROOT, "audit", workspaceId, params],
  // EVERY workspace's roster, not one. Not a read key — nothing fetches it —
  // but the invalidation scope of a write that moves a name the whole fleet
  // shares: `MemberResponse.display_name` is a live lookup in
  // stapel-profiles, so a rename lands on the person's CANONICAL name and
  // every roster that lists them is stale at once, not just the one the
  // admin happened to be looking at.
  membersAll: () => [ROOT, "members"],
  membersPage: (workspaceId, params) => [ROOT, "members", workspaceId, params],
  // Same prefix trick as `members`: the bare 3-tuple invalidates every page
  // (and the infinite list, which keys on it) after a revoke / resend.
  invitations: (workspaceId) => [ROOT, "invitations", workspaceId],
  invitationsPage: (workspaceId, params) => [
    ROOT,
    "invitations",
    workspaceId,
    params,
  ],
  // The infinite list carries its own marker segment: its cached value is an
  // `InfiniteData` envelope, not a page, so it must never collide with a
  // single-page key that happens to hold the same filters.
  invitationsInfinite: (workspaceId, filters) => [
    ROOT,
    "invitations",
    workspaceId,
    "infinite",
    filters,
  ],
  roles: () => [ROOT, "roles"],
  instance: () => [ROOT, "instance"],
  // NOTE: the key carries the invite TOKEN (a secret). Core's query persist
  // scope is per-user and the preview response is already public-by-design
  // (masked email only) — but hosts logging query keys should treat this one
  // as sensitive.
  invitationPreview: (token) => [ROOT, "invitation-preview", token],
};
