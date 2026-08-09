/**
 * Wire types for the stapel-workspaces HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-workspaces's OWN `docs/schema.json` — the
 * §17-native per-module contract, not the unified monolith). Alias the schemas this pair uses under local
 * names here; do NOT write parallel response bodies. Where drf-spectacular +
 * openapi-typescript under-describe the runtime, apply a small documented
 * correction (see auth-react `api/types.ts` for the three canonical patterns).
 */
import type { components, operations } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** The generated operation table — the source of truth for QUERY parameters
 * (drf-spectacular declares them per-operation, not as a component schema). */
export type Operations = operations;

// ── aliases (the stapel-workspaces schemas this pair uses) ────────────────────

/** One workspace — identity, storage, my role, member count (GET/POST/PATCH). */
export type Workspace = Schemas["WorkspaceResponse"];
/** GET / 200 body — the caller's workspaces (memberships). */
export type WorkspaceList = Schemas["WorkspaceListResponse"];
/** PUT /me/preferred-workspace request body — the workspace the person is
 * choosing as home. Must be one they actively belong to; anything else
 * (unknown, not a member, invitation still pending, membership suspended)
 * answers ONE identical `error.404.workspace_not_found`, so the endpoint
 * cannot be used to probe which workspace ids are real. */
export type PreferredWorkspace = Schemas["PreferredWorkspaceRequest"];
/** PUT/DELETE /me/preferred-workspace 200 body — the choice after the write
 * (`""` after a DELETE cleared it). */
export type PreferredWorkspaceResult = Schemas["PreferredWorkspaceResponse"];
/** POST / request body — create a workspace (slug auto-generated when omitted). */
export type WorkspaceCreate = Schemas["WorkspaceCreateRequest"];
/** PATCH /{id} request body — a partial name / slug / settings update. */
export type WorkspaceUpdate = Schemas["PatchedWorkspaceUpdateRequest"];
/** One workspace member (GET members, PATCH member role, POST accept). */
export type Member = Schemas["MemberResponse"];
/** GET /{id}/members 200 body — an anchor-paginated page of a workspace's {@link Member}s. */
export type MemberPage = Schemas["PaginatedMemberResponseList"];
/** POST /{id}/members/invite request body — one or more emails + a role. */
export type MemberInvite = Schemas["MemberInviteRequest"];
/** POST /{id}/members/invite 201 body — the created invitations. */
export type MemberInviteResult = Schemas["MemberInviteResponse"];
/** PATCH /{id}/members/{userId} request body — the new role. */
export type MemberRoleUpdate = Schemas["PatchedMemberUpdateRequest"];
/** One pending/accepted invitation (a row of {@link MemberInviteResult}, and
 * a row of the admin's invitation table — GET /{id}/invitations). The invite
 * TOKEN is deliberately absent from this shape: it is a bearer credential
 * that only ever leaves the backend inside the invitation email. */
export type Invitation = Schemas["InvitationResponse"];
/** GET /{id}/invitations 200 body — an anchor-paginated page of {@link Invitation}s. */
export type InvitationPage = Schemas["PaginatedInvitationResponseList"];
/** POST /{id}/members/{userId}/password/reset request body — an optional
 * admin-chosen password, the first-login demands to raise, and an audit note. */
export type MemberPasswordReset = Schemas["MemberPasswordResetRequest"];
/** POST /{id}/members/{userId}/password/reset 200 body. `generated_password`
 * is a ONE-SHOT credential (present only when the request omitted `password`)
 * — see {@link "../model/mutations.js".useResetMemberPassword}, which keeps it
 * out of the query cache. */
export type MemberPasswordResetResult = Schemas["MemberPasswordResetResponse"];
/**
 * PATCH /{id}/members/{userId}/name and PATCH
 * /{id}/invitations/{invitationId}/name request body — the ONE field both
 * name-edit endpoints take (stapel-workspaces ≥0.19.0). Blank,
 * whitespace-only, `null` and a missing key all mean the same thing to the
 * backend: clear the name. The value is held to stapel-profiles'
 * `validate_display_name` canon (35-char ceiling as the serializer's
 * `max_length`) — this module declares no second, differently-strict rule.
 */
export type DisplayNameUpdate = Schemas["PatchedDisplayNameUpdateRequest"];
/** PATCH …/name 200 body — what the name IS after the write (the stored,
 * trimmed, canon-checked value; empty string when the name was cleared), not
 * an echo of the request. */
export type DisplayNameResult = Schemas["DisplayNameResponse"];
/** POST /invitations/accept request body — the token from the email link. */
export type InvitationAccept = Schemas["InvitationAcceptRequest"];
/** GET /invitations/{token} 200 body — the public (AllowAny) preview the
 * `/invite/{token}` page renders before any auth decision (org-program §B2). */
export type InvitationPreview = Schemas["InvitationPreviewResponse"];
/** POST /invitations/{token}/claim 200 body — the single-use login grant for a
 * not-yet-registered invitee; exchange it at auth's POST /grant/exchange/. */
export type InvitationClaim = Schemas["InvitationClaimResponse"];
/** One role of the effective registry (builtin + `STAPEL_WORKSPACES["ROLES"]`
 * overlay) — GET /roles (org-program §A2). Capability strings are verbatim,
 * wildcards (`*`, `members.*`) included. */
export type RoleInfo = Schemas["RoleResponse"];
/** GET /roles 200 body — the effective role registry, rank-descending. */
export type RoleList = Schemas["RoleListResponse"];

/**
 * Deployment shape: what a person landing "off the street" gets, and
 * whether self-serve signup is open. A property of the INSTANCE, not of a
 * workspace — and not a setting the customer can toggle: it's fixed at
 * deployment time.
 */
export type InstanceShape = Schemas["InstanceShapeResponse"];

// ── documented corrections (drf-spectacular under-describes) ──────────────────

/**
 * A BUILTIN workspace membership role, ordered least→most privileged. Since
 * stapel-workspaces 0.6.0 (org-program §A1) the effective registry is
 * settings-extensible — a deployment can add roles (`secretary`, …) via
 * `STAPEL_WORKSPACES["ROLES"]`, so `MemberResponse.role` is genuinely an open
 * `string` on the wire and the registry endpoint (GET /roles, {@link RoleInfo})
 * is the source of truth for what exists. This union names the four builtin
 * keys that are ALWAYS present (with `owner` system-protected); use it for
 * literals, not to validate server data.
 */
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

/**
 * A workspace category. The generated schema types `WorkspaceResponse.type` /
 * the create `type` as a bare `string`; the backend (`models.WorkspaceType`)
 * constrains it to exactly these two. Narrowed for the same reason as
 * {@link WorkspaceRole}.
 */
export type WorkspaceKind = "personal" | "work";

/**
 * Anchor-pagination query for GET /{id}/members (core `AnchorPagination`, same
 * shape as notifications-react's `NotificationFeedParams`). All optional: no
 * params fetches the newest page (default limit 100, max 500).
 */
export interface MembersParams {
  /** Anchor value to paginate from (exclusive) — a page's `next_anchor`. */
  readonly anchor?: string;
  /** Pagination direction relative to `anchor`. */
  readonly direction?: "next" | "prev" | "center";
  /** Page size (default 100, max 500). */
  readonly limit?: number;
  /** Case-insensitive substring filter matched against a member's email or display name. */
  readonly search?: string;
}

/**
 * Which invitations GET /{id}/invitations returns. Taken VERBATIM from the
 * generated operation table (not re-typed by hand): `pending` (the backend
 * default) — live, seat-reserving invitations, i.e. who has not accepted yet;
 * `never_accepted` — those plus declined / revoked / expired; `all` — the full
 * history, accepted rows included.
 */
export type InvitationStatusFilter = NonNullable<
  NonNullable<
    Operations["workspaces_api_v1_invitations_list"]["parameters"]["query"]
  >["status"]
>;

/**
 * Anchor-pagination query for GET /{id}/invitations (core `AnchorPagination`,
 * the same shape as {@link MembersParams} plus the `status` filter). All
 * optional: no params fetches the newest page of PENDING invitations
 * (default limit 100, max 500).
 *
 * ANCHOR, not page numbers: a page is addressed by the opaque `next_anchor`
 * of the page before it. There is no "page 3" to jump to and no offset to
 * skew when an invitation is revoked mid-scroll.
 */
export interface InvitationsParams {
  /** Anchor value to paginate from (exclusive) — a page's `next_anchor`. */
  readonly anchor?: string;
  /** Pagination direction relative to `anchor`. */
  readonly direction?: "next" | "prev" | "center";
  /** Page size (default 100, max 500). */
  readonly limit?: number;
  /** Case-insensitive substring filter on the invited email address. */
  readonly search?: string;
  /** Which invitations to return (default `pending`). */
  readonly status?: InvitationStatusFilter;
}

/**
 * One first-login demand an organization may raise on an account it admits
 * (`settings.security.provisioned_user_policies`, backend dto
 * `PROVISIONED_USER_POLICIES`). INDEPENDENT checkboxes, not alternatives — an
 * org may demand both. NOT GENERATED: the security block lives inside the
 * free-form `Workspace.settings` JSON, so drf-spectacular types it as an
 * untyped object; the backend serializer validates exactly these two values.
 */
export type ProvisionedUserPolicy = "password_change" | "mfa_enroll";

/**
 * Typed shape of `Workspace.settings.security` (backend dto
 * `WorkspaceSecuritySettings`, org-program §C3). A documented correction for
 * the same reason as {@link WorkspaceRole}: the block is stored inside the
 * free-form settings JSON (no schema migration on the backend), so the
 * generated types say `object` and this is the canon of the known keys.
 * Unknown keys are preserved verbatim by the backend — hence the index
 * signature, and hence why the update hook MERGES rather than replaces.
 */
export interface WorkspaceSecuritySettings {
  /** Whether membership requires a strong second factor. Turning it on
   * sweeps current members and suspends those without one (reason `no_mfa`). */
  readonly require_mfa?: boolean;
  /**
   * First-login steps demanded of accounts the org admits — a LIST since
   * stapel-workspaces 0.13.0 (#90). The pre-0.13 singular
   * `provisioned_user_policy` string is still read by the backend for old
   * rows, but this pair only ever WRITES the list: a client that keeps
   * writing the singular spelling silently caps the org at one demand.
   */
  readonly provisioned_user_policies?: readonly ProvisionedUserPolicy[];
  /** Derived, read-only: whether the org actually set the policies (as
   * opposed to inheriting the `password_change` default). Never sent. */
  readonly policies_configured?: boolean;
  /** Extra keys pass through the backend verbatim (client extension). */
  readonly [extra: string]: unknown;
}
