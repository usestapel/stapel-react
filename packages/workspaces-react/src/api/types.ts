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
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── aliases (the stapel-workspaces schemas this pair uses) ────────────────────

/** One workspace — identity, storage, my role, member count (GET/POST/PATCH). */
export type Workspace = Schemas["WorkspaceResponse"];
/** GET / 200 body — the caller's workspaces (memberships). */
export type WorkspaceList = Schemas["WorkspaceListResponse"];
/** POST / request body — create a workspace (slug auto-generated when omitted). */
export type WorkspaceCreate = Schemas["WorkspaceCreateRequest"];
/** PATCH /{id} request body — a partial name / slug / settings update. */
export type WorkspaceUpdate = Schemas["PatchedWorkspaceUpdateRequest"];
/** One workspace member (GET members, PATCH member role, POST accept). */
export type Member = Schemas["MemberResponse"];
/** GET /{id}/members 200 body — a workspace's members. */
export type MemberList = Schemas["MemberListResponse"];
/** POST /{id}/members/invite request body — one or more emails + a role. */
export type MemberInvite = Schemas["MemberInviteRequest"];
/** POST /{id}/members/invite 201 body — the created invitations. */
export type MemberInviteResult = Schemas["MemberInviteResponse"];
/** PATCH /{id}/members/{userId} request body — the new role. */
export type MemberRoleUpdate = Schemas["PatchedMemberUpdateRequest"];
/** One pending/accepted invitation (a row of {@link MemberInviteResult}). */
export type Invitation = Schemas["InvitationResponse"];
/** POST /invitations/accept request body — the token from the email link. */
export type InvitationAccept = Schemas["InvitationAcceptRequest"];

// ── documented corrections (drf-spectacular under-describes) ──────────────────

/**
 * A workspace membership role, ordered least→most privileged. The generated
 * schema types `MemberResponse.role` / the invite `role` as a bare `string`,
 * but the backend (`models.Role`, a Django `TextChoices`) constrains it to
 * exactly these values. Narrowing here gives call sites a checked union — a
 * documented correction of the same kind auth-react/billing-react apply.
 */
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

/**
 * A workspace category. The generated schema types `WorkspaceResponse.type` /
 * the create `type` as a bare `string`; the backend (`models.WorkspaceType`)
 * constrains it to exactly these two. Narrowed for the same reason as
 * {@link WorkspaceRole}.
 */
export type WorkspaceKind = "personal" | "work";
