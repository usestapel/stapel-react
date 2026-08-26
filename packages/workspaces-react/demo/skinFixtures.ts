/**
 * Canned backend answers for the DEFAULT-SKIN demos — one place, because the
 * seven screens overlap (a roster needs the role registry, an invitations
 * pane needs it too) and a fixture copied per file is a fixture that drifts.
 *
 * Every object here is the shape stapel-workspaces 0.30.0 actually sends,
 * field for field, so a demo that renders is evidence the screen reads the
 * contract and not a shape somebody hoped for. `is_self` is the 0.30.0
 * addition these fixtures exist to exercise: the roster's own row gets it
 * true, and both controls the server refuses on that row (remove, password
 * reset) are switched off with the reason beside them.
 *
 * The harness matches a handler by `url.includes(suffix)` in INSERTION order,
 * so the maps below list the specific suffixes first and the bare
 * `"/workspaces/api/"` catch-all (the workspace LIST) last.
 */
import type { DemoHandlers } from "./_harness.js";

export const DEMO_WS = "0192f000-0000-4000-8000-000000000001";
const OTHER_WS = "0192f000-0000-4000-8000-000000000002";
const VIEWER = "0192a000-0000-4000-8000-000000000001";

/** The effective role registry (GET /roles) — the builtin four plus a
 * deployment overlay role with no `workspaces.role.*` copy, which the field
 * title-cases rather than printing a slug. */
export const ROLES = {
  roles: [
    { role: "owner", rank: 400, capabilities: ["*"], builtin: true },
    { role: "admin", rank: 300, capabilities: ["members.*"], builtin: true },
    {
      role: "secretary",
      rank: 250,
      capabilities: ["members.view"],
      builtin: false,
    },
    { role: "member", rank: 200, capabilities: ["members.view"], builtin: true },
    { role: "viewer", rank: 100, capabilities: ["workspace.view"], builtin: true },
  ],
  capability_levels: {
    "members.provision": "high",
    "members.password.reset": "high",
    "workspace.security.manage": "high",
  },
};

/** One workspace, as GET /{id} sends it. */
export const WORKSPACE = {
  id: DEMO_WS,
  name: "Acme Engineering",
  slug: "acme-eng",
  type: "work",
  owner_id: VIEWER,
  owner_display_name: "Ada Lovelace",
  settings: { security: { require_mfa: false, provisioned_user_policies: ["password_change"] } },
  storage_used_bytes: 2147483648,
  storage_limit_bytes: 5368709120,
  member_count: 4,
  my_role: "owner",
  my_capabilities: ["*"],
  can_delete: true,
  delete_blocked_reason: null,
  created_at: "2026-05-20T10:00:00Z",
  updated_at: "2026-08-19T09:30:00Z",
};

/** The same workspace the server refuses to delete — an OWNER, and still no:
 * it is the instance default. The reason is the server's own error code. */
export const WORKSPACE_UNDELETABLE = {
  ...WORKSPACE,
  can_delete: false,
  delete_blocked_reason: "error.409.workspace_is_instance_default",
  settings: {
    security: { require_mfa: true, provisioned_user_policies: ["password_change", "mfa_enroll"] },
    mfa_enforcement: {
      state: "partial",
      checked_members: 4,
      noncompliant_members: 1,
      unverified_members: 2,
      attempts: 6,
      last_attempt_at: "2026-08-23T21:15:00Z",
      completed_at: null,
      last_error: "",
    },
  },
};

/** The caller's workspaces (GET /). */
export const WORKSPACE_LIST = {
  workspaces: [
    WORKSPACE,
    {
      ...WORKSPACE,
      id: OTHER_WS,
      name: "Ada's space",
      slug: "ada",
      type: "personal",
      member_count: 1,
      my_role: "owner",
      owner_display_name: "Ada Lovelace",
    },
  ],
  preferred_workspace_id: DEMO_WS,
  default_workspace_id: null,
  can_create_workspace: true,
};

export const WORKSPACE_LIST_EMPTY = {
  workspaces: [],
  preferred_workspace_id: null,
  default_workspace_id: null,
  can_create_workspace: false,
};

/** The instance shape (GET /instance) — who may make a workspace here. */
export const INSTANCE_OPEN = { open_registration: true, allow_workspace_creation: true };
export const INSTANCE_CLOSED = { open_registration: false, allow_workspace_creation: false };

function member(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "0192b000-0000-4000-8000-000000000009",
    workspace_id: DEMO_WS,
    user_id: "0192a000-0000-4000-8000-000000000009",
    email: "member@example.com",
    display_name: null,
    role: "member",
    invited_at: "2026-05-21T10:00:00Z",
    accepted_at: "2026-05-21T10:05:00Z",
    last_accessed_at: "2026-08-22T08:00:00Z",
    suspended_at: null,
    suspension_reason: null,
    provisioned: false,
    mfa_compliant: null,
    is_self: false,
    ...overrides,
  };
}

function page(items: readonly unknown[]): Record<string, unknown> {
  return {
    items,
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: items.length,
  };
}

/** The roster: the viewer's own row first (`is_self`), then the three kinds of
 * two-factor evidence — confirmed, missing, and nobody has asked. */
export const MEMBERS = page([
  member({
    id: "0192b000-0000-4000-8000-000000000001",
    user_id: VIEWER,
    email: "ada@acme.test",
    display_name: "Ada Lovelace",
    role: "owner",
    mfa_compliant: true,
    is_self: true,
  }),
  member({
    id: "0192b000-0000-4000-8000-000000000002",
    user_id: "0192a000-0000-4000-8000-000000000002",
    email: "grace@acme.test",
    display_name: "Grace Hopper",
    role: "admin",
    mfa_compliant: false,
    suspended_at: "2026-08-20T12:00:00Z",
    suspension_reason: "no_mfa",
  }),
  member({
    id: "0192b000-0000-4000-8000-000000000003",
    user_id: "0192a000-0000-4000-8000-000000000003",
    email: "katherine@acme.test",
    display_name: "Katherine Johnson",
    role: "secretary",
    provisioned: true,
    last_accessed_at: null,
  }),
]);

export const MEMBERS_EMPTY = page([]);

function invitation(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "0192c000-0000-4000-8000-000000000009",
    workspace_id: DEMO_WS,
    email: "new@acme.test",
    display_name: null,
    role: "member",
    status: "pending",
    expires_at: "2026-09-06T10:00:00Z",
    last_sent_at: "2026-08-23T10:00:00Z",
    accepted_at: null,
    declined_at: null,
    revoked_at: null,
    created_at: "2026-08-23T10:00:00Z",
    invited_by_id: VIEWER,
    ...overrides,
  };
}

export const INVITATIONS = page([
  invitation({ id: "0192c000-0000-4000-8000-000000000001", email: "alan@acme.test" }),
  invitation({
    id: "0192c000-0000-4000-8000-000000000002",
    email: "margaret@acme.test",
    display_name: "Margaret Hamilton",
    role: "admin",
    last_sent_at: null,
  }),
]);

/** Rows the endpoints would refuse — the gates say so instead of offering a
 * control that leads to a 400. */
export const INVITATIONS_TERMINAL = page([
  invitation({
    id: "0192c000-0000-4000-8000-000000000003",
    email: "alan@acme.test",
    status: "expired",
    expires_at: "2026-08-01T10:00:00Z",
  }),
  invitation({
    id: "0192c000-0000-4000-8000-000000000004",
    email: "margaret@acme.test",
    status: "accepted",
    accepted_at: "2026-08-10T09:00:00Z",
  }),
  invitation({
    id: "0192c000-0000-4000-8000-000000000005",
    email: "john@acme.test",
    status: "revoked",
    revoked_at: "2026-08-12T09:00:00Z",
  }),
]);

export const INVITATIONS_EMPTY = page([]);

function auditEvent(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "0192d000-0000-4000-8000-000000000009",
    action: "member_joined",
    actor_id: VIEWER,
    actor_display_name: "Ada Lovelace",
    subject_id: "0192a000-0000-4000-8000-000000000002",
    subject_display_name: "Grace Hopper",
    subject_email: "grace@acme.test",
    role: "admin",
    metadata: {},
    created_at: "2026-08-22T09:00:00Z",
    ...overrides,
  };
}

export const AUDIT = page([
  auditEvent({ id: "0192d000-0000-4000-8000-000000000001", action: "invitation_created" }),
  auditEvent({ id: "0192d000-0000-4000-8000-000000000002", action: "member_joined" }),
  auditEvent({
    id: "0192d000-0000-4000-8000-000000000003",
    action: "member_role_changed",
    metadata: { old_role: "member", new_role: "admin" },
  }),
  // Nobody performed it: the `require_mfa` sweep. The line says "The system",
  // never a blank actor.
  auditEvent({
    id: "0192d000-0000-4000-8000-000000000004",
    action: "member_suspended",
    actor_id: null,
    actor_display_name: "",
    metadata: { reason: "no_mfa" },
    created_at: "2026-08-20T12:00:00Z",
  }),
]);

export const AUDIT_EMPTY = page([]);

/** The public invitation preview (GET /invitations/{token}) — masked address,
 * because the page is reachable by anyone holding the link. */
export const INVITE_TOKEN = "demo-invite-token";
export const INVITE_PREVIEW = {
  workspace_name: "Acme Engineering",
  role: "member",
  // maskEmail("ada@acme.test") — the session below matches it.
  email_masked: "a***@a***.test",
  status: "pending",
  email_registered: true,
  expires_at: "2026-09-06T10:00:00Z",
};
export const INVITE_SESSION_EMAIL = "ada@acme.test";
export const INVITE_OTHER_SESSION_EMAIL = "grace@acme.test";
export const INVITE_PREVIEW_EXPIRED = { ...INVITE_PREVIEW, status: "expired" };

/** A failure with a code the pair's generated bundle can translate — the
 * point of the error arms is a sentence, never a raw key. */
const SERVER_DOWN: readonly [number, unknown] = [
  503,
  { error: { code: "error.503.service_unavailable", message: "Service unavailable" } },
];

// ── handler maps, one per demo variant ───────────────────────────────────────

export const WORKSPACES_PAGE_HANDLERS: DemoHandlers = {
  "/instance": INSTANCE_OPEN,
  "/workspaces/api/": WORKSPACE_LIST,
};

export const WORKSPACES_PAGE_EMPTY_HANDLERS: DemoHandlers = {
  "/instance": INSTANCE_CLOSED,
  "/workspaces/api/": WORKSPACE_LIST_EMPTY,
};

export const WORKSPACES_PAGE_FAILED_HANDLERS: DemoHandlers = {
  "/instance": INSTANCE_OPEN,
  "/workspaces/api/": SERVER_DOWN,
};

export const SETTINGS_HANDLERS: DemoHandlers = {
  "/roles": ROLES,
  "/workspaces/api/": WORKSPACE,
};

export const SETTINGS_LOCKED_HANDLERS: DemoHandlers = {
  "/roles": ROLES,
  "/workspaces/api/": WORKSPACE_UNDELETABLE,
};

export const MEMBERS_HANDLERS: DemoHandlers = {
  "/members": MEMBERS,
  "/roles": ROLES,
  "/workspaces/api/": WORKSPACE,
};

export const MEMBERS_EMPTY_HANDLERS: DemoHandlers = {
  "/members": MEMBERS_EMPTY,
  "/roles": ROLES,
  "/workspaces/api/": WORKSPACE,
};

export const INVITATIONS_HANDLERS: DemoHandlers = {
  "/invitations": INVITATIONS,
  "/roles": ROLES,
  "/workspaces/api/": WORKSPACE,
};

export const INVITATIONS_TERMINAL_HANDLERS: DemoHandlers = {
  "/invitations": INVITATIONS_TERMINAL,
  "/roles": ROLES,
  "/workspaces/api/": WORKSPACE,
};

export const INVITATIONS_EMPTY_HANDLERS: DemoHandlers = {
  "/invitations": INVITATIONS_EMPTY,
  "/roles": ROLES,
  "/workspaces/api/": WORKSPACE,
};

export const AUDIT_HANDLERS: DemoHandlers = {
  "/audit": AUDIT,
  "/workspaces/api/": WORKSPACE,
};

export const AUDIT_EMPTY_HANDLERS: DemoHandlers = {
  "/audit": AUDIT_EMPTY,
  "/workspaces/api/": WORKSPACE,
};

export const ROLES_HANDLERS: DemoHandlers = { "/roles": ROLES };

export const ROLES_DOWN_HANDLERS: DemoHandlers = { "/roles": SERVER_DOWN };

export const INVITE_HANDLERS: DemoHandlers = {
  [`/invitations/${INVITE_TOKEN}`]: INVITE_PREVIEW,
};

export const INVITE_EXPIRED_HANDLERS: DemoHandlers = {
  [`/invitations/${INVITE_TOKEN}`]: INVITE_PREVIEW_EXPIRED,
};
