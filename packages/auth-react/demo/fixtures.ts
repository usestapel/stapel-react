/**
 * Canned backend answers the default-skin demos render against.
 *
 * One place, because the same account has to look like the same account
 * across the stories: the security page's sessions are the sessions the
 * sessions demo shows, and the passkey that has never been used is the same
 * credential in both. Fixtures scattered per file drift, and a showcase whose
 * screens disagree with each other is worse evidence than none.
 *
 * The mock `fetch` in `./_harness.tsx` matches a request by URL SUFFIX, first
 * match wins, so a map's key order is meaningful: a more specific path is
 * declared before the prefix that would swallow it (`/passkey/register/…`
 * before `/passkey/`).
 */
import type { DemoHandlers } from "./_harness.js";

/** A deployment with every channel on — the widest surface a skin can draw. */
export const CAPABILITIES = {
  registration: {
    oauth: [
      { id: "google", name: "Google", icon_svg: "" },
      { id: "github", name: "GitHub", icon_svg: "" },
    ],
    phone: true,
    email: true,
    password: true,
    sso: true,
    anonymous: true,
  },
  login: {
    oauth: [
      { id: "google", name: "Google", icon_svg: "" },
      { id: "github", name: "GitHub", icon_svg: "" },
    ],
    phone: true,
    email: true,
    password: true,
    sso: true,
    qr: true,
    passkey: true,
    magic_link: true,
  },
  mfa: { totp: true, passkey: true },
  methods: [
    { id: "email", enabled: true, placement: "main", order: 0, interaction: "inline", icon_svg: "", can_login: true, can_register: true },
    { id: "phone", enabled: true, placement: "main", order: 1, interaction: "inline", icon_svg: "", can_login: true, can_register: true },
    { id: "password", enabled: true, placement: "overflow", order: 0, interaction: "modal", icon_svg: "", can_login: true, can_register: false },
    { id: "qr", enabled: true, placement: "bottom", order: 0, interaction: "modal", icon_svg: "", can_login: true, can_register: false },
    { id: "passkey", enabled: true, placement: "bottom", order: 1, interaction: "inline", icon_svg: "", can_login: true, can_register: false },
    { id: "oauth", enabled: true, placement: "bottom", order: 2, interaction: "redirect", icon_svg: "", can_login: true, can_register: true },
  ],
  otp: {
    email_code_length: 6,
    phone_code_length: 4,
    totp_code_length: 6,
    ttl_seconds: 300,
    resend_cooldown_seconds: 30,
  },
};

/** Nothing is configured: every provider list empty, every channel off. The
 *  state a skin must render as an empty deployment, not as a failure. */
export const CAPABILITIES_BARE = {
  ...CAPABILITIES,
  registration: { ...CAPABILITIES.registration, oauth: [] },
  login: { ...CAPABILITIES.login, oauth: [] },
};

export const ME = {
  id: "8f1d8f7a-2e2b-4b5f-9d3a-6d1a0b2c3d4e",
  email: "ada@example.com",
  phone: "+44 20 7946 0958",
  username: "ada",
  display_name: "Ada Lovelace",
  is_anonymous: false,
};

export const SECURITY_STATUS_STRONG = {
  password: { is_set: true },
  totp: { is_enabled: true, backup_codes_remaining: 8 },
  email: { value: "ada@example.com", is_verified: true },
  phone: { value: "+44 20 7946 0958", is_verified: true },
  oauth: { connected_providers: ["google"] },
  sessions: { active_count: 3 },
  passkeys: { count: 2 },
};

/** The account that has done nothing yet — every security screen's "you have
 *  not set this up" arm, which is the arm people actually see first. */
export const SECURITY_STATUS_BARE = {
  password: { is_set: false },
  totp: { is_enabled: false, backup_codes_remaining: 0 },
  email: { value: "ada@example.com", is_verified: false },
  phone: { value: null, is_verified: false },
  oauth: { connected_providers: [] },
  sessions: { active_count: 1 },
  passkeys: { count: 0 },
};

export const SESSIONS = [
  {
    id: "s-1",
    device_type: "desktop",
    device_name: "Chrome on macOS",
    device_details: "MacBook Pro",
    ip_address: "95.24.17.5",
    created_at: "2026-08-01T08:00:00Z",
    last_used_at: "2026-08-24T09:30:00Z",
    is_current: true,
    is_suspicious: false,
  },
  {
    id: "s-2",
    device_type: "phone",
    device_name: "Safari on iPhone",
    device_details: "iPhone 15",
    ip_address: "82.16.4.201",
    created_at: "2026-07-11T19:20:00Z",
    last_used_at: "2026-08-23T21:05:00Z",
    is_current: false,
    is_suspicious: false,
  },
  {
    id: "s-3",
    device_type: "desktop",
    device_name: "Firefox on Windows",
    device_details: "Unknown PC",
    ip_address: "45.9.148.77",
    created_at: "2026-08-22T02:14:00Z",
    last_used_at: "2026-08-22T02:16:00Z",
    is_current: false,
    is_suspicious: true,
  },
];

export const PASSKEYS = {
  passkeys: [
    {
      id: "pk-1",
      device_name: "MacBook Touch ID",
      aaguid: "adce0002-35bc-c60a-648b-0b25f1f05503",
      transports: ["internal"],
      created_at: "2026-06-14T09:12:00Z",
      last_used_at: null,
    },
    {
      id: "pk-2",
      device_name: "YubiKey 5C",
      aaguid: "cb69481e-8ff7-4039-93ec-0a2729a154a8",
      transports: ["usb", "nfc"],
      created_at: "2026-02-02T18:40:00Z",
      last_used_at: "2026-08-21T07:05:00Z",
    },
  ],
};

export const OAUTH_LINKS = {
  links: [
    {
      provider: "google",
      email: "ada@example.com",
      display_name: "Ada Lovelace",
      linked_at: "2026-03-04T10:00:00Z",
      primary: true,
    },
  ],
};

export const AUDIT_PAGE = {
  count: 42,
  next: 2,
  results: [
    {
      id: "a-1",
      event_type: "user.login_succeeded",
      ip_address: "95.24.17.5",
      user_agent: "Chrome/126",
      metadata: {},
      created_at: "2026-08-24T09:30:00Z",
    },
    {
      id: "a-2",
      event_type: "user.login_suspicious",
      ip_address: "45.9.148.77",
      user_agent: "Firefox/128",
      metadata: {},
      created_at: "2026-08-22T02:14:00Z",
    },
    {
      id: "a-3",
      event_type: "passkey_renamed",
      ip_address: "95.24.17.5",
      user_agent: "Chrome/126",
      metadata: {},
      created_at: "2026-08-20T11:02:00Z",
    },
  ],
};

export const AUDIT_EMPTY = { count: 0, next: null, results: [] };

export const PASSWORD_METHODS = [
  { method: "password", available: true, masked_target: null },
  { method: "email", available: true, masked_target: "a•••@example.com" },
];

export const NO_DELAYED_CHANGE = { has_pending_change: false };

export const PENDING_DELAYED_CHANGE = {
  has_pending_change: true,
  change_request_id: "cr-9",
  new_value_masked: "a•••@newmail.com",
  scheduled_at: "2026-09-01T09:00:00Z",
  days_remaining: 6,
  can_cancel: true,
};

// ── Step-up verification preferences ────────────────────────────────────────

export const VERIFICATION_PREFERENCES = {
  preferences: [
    { scope: "verification.settings", enabled: true },
    { scope: "wallet.withdraw", enabled: false },
  ],
};

/** No decisions taken: every scope follows the deployment's own level, which
 *  the rows say rather than drawing a confident "off". */
export const VERIFICATION_PREFERENCES_UNSET = { preferences: [] };

// ── Operator console ────────────────────────────────────────────────────────

export const SSO_ORGS = [
  {
    id: "org-1",
    name: "Acme Corporation",
    slug: "acme",
    domain: "acmecorp.com",
    sso_enforced: true,
    created_at: "2026-01-19T10:00:00Z",
  },
  {
    id: "org-2",
    name: "Initech",
    slug: "initech",
    domain: "initech.io",
    sso_enforced: false,
    created_at: "2026-05-02T14:30:00Z",
  },
];

export const SERVICE_KEYS = [
  {
    id: 1,
    name: "Billing reconciler",
    key: "sk_live_••••••••••••7f21",
    description: "Nightly invoice sync",
    is_active: true,
    created_at: "2026-04-08T06:00:00Z",
    last_used_at: "2026-08-24T03:00:00Z",
    allowed_endpoints: ["/billing/api/v1/invoices/", "/billing/api/v1/credits/"],
  },
  {
    id: 2,
    name: "Staging smoke runner",
    key: "sk_test_••••••••••••1a04",
    description: "",
    is_active: false,
    created_at: "2026-06-30T12:00:00Z",
    last_used_at: null,
    allowed_endpoints: [],
  },
];

export const STAFF_ROLES = [
  {
    id: "sr-1",
    user: "8f1d8f7a-2e2b-4b5f-9d3a-6d1a0b2c3d4e",
    role_name: "moderator",
    assigned_by: "1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
    created_at: "2026-07-01T09:00:00Z",
  },
  {
    id: "sr-2",
    user: "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    role_name: "support",
    assigned_by: null,
    created_at: "2026-02-14T08:30:00Z",
  },
];

// ── Assembled handler maps ──────────────────────────────────────────────────

export const SECURITY_HANDLERS: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/me/": ME,
  "/security/status/": SECURITY_STATUS_STRONG,
  "/security/audit/": AUDIT_PAGE,
  "/password/methods/": PASSWORD_METHODS,
  "/sessions/": SESSIONS,
  "/passkey/": PASSKEYS,
  "/oauth/links/": OAUTH_LINKS,
  "/totp/change/delayed/status/": NO_DELAYED_CHANGE,
  "/email/change/delayed/status/": NO_DELAYED_CHANGE,
  "/phone/change/delayed/status/": NO_DELAYED_CHANGE,
  "/verification/preferences/": VERIFICATION_PREFERENCES,
};

/** The same deployment, seen by an account that has set nothing up. */
export const SECURITY_HANDLERS_BARE: DemoHandlers = {
  ...SECURITY_HANDLERS,
  "/security/status/": SECURITY_STATUS_BARE,
  "/security/audit/": AUDIT_EMPTY,
  "/sessions/": [SESSIONS[0]],
  "/passkey/": { passkeys: [] },
  "/oauth/links/": { links: [] },
  "/verification/preferences/": VERIFICATION_PREFERENCES_UNSET,
};

export const ADMIN_HANDLERS: DemoHandlers = {
  "/sso/orgs/": SSO_ORGS,
  "/service-keys": SERVICE_KEYS,
  "/staff-roles/": STAFF_ROLES,
  "/admin/audit/": AUDIT_PAGE,
};

export const ADMIN_HANDLERS_EMPTY: DemoHandlers = {
  "/sso/orgs/": [],
  "/service-keys": [],
  "/staff-roles/": [],
  "/admin/audit/": AUDIT_EMPTY,
};

/** Every read refuses. The screens must state the refusal — a staff surface
 *  that renders an empty list over a 403 tells an operator the opposite of
 *  what happened. */
export const ADMIN_HANDLERS_FORBIDDEN: DemoHandlers = {
  "/sso/orgs/": [403, { localizable_error: "error.403.forbidden" }],
  "/service-keys": [403, { localizable_error: "error.403.forbidden" }],
  "/staff-roles/": [403, { localizable_error: "error.403.forbidden" }],
  "/admin/audit/": [403, { localizable_error: "error.403.forbidden" }],
};
