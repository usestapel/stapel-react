/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"auth"` root so a host can invalidate the whole module
 * or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`.
 */
const ROOT = "auth" as const;

export const authQueryKeys: {
  readonly all: readonly ["auth"];
  capabilities(): readonly ["auth", "capabilities"];
  me(): readonly ["auth", "me"];
  securityStatus(): readonly ["auth", "security", "status"];
  passwordMethods(): readonly ["auth", "password", "methods"];
  sessions(): readonly ["auth", "sessions"];
  passkeys(): readonly ["auth", "passkeys"];
  oauthLinks(): readonly ["auth", "oauth", "links"];
  audit(page: number): readonly ["auth", "audit", number];
  delayedChange(channel: string): readonly ["auth", "change", "delayed", string];
  totpDelayedChange(): readonly ["auth", "totp", "change", "delayed"];
  ssoLookup(domain: string): readonly ["auth", "sso", "lookup", string];
  verificationPreferences(): readonly ["auth", "verification", "preferences"];
  ssoOrgs(): readonly ["auth", "admin", "sso", "orgs"];
  ssoOrg(slug: string): readonly ["auth", "admin", "sso", "orgs", string];
  ssoOrgConfig(slug: string): readonly ["auth", "admin", "sso", "orgs", string, "config"];
  serviceKeys(): readonly ["auth", "admin", "service-keys"];
  staffRoles(userId: string): readonly ["auth", "admin", "staff-roles", string];
  /** Every staff-roles read, whatever it is filtered by — the invalidation
   *  target after an assign/remove, which changes rows in all of them. */
  staffRolesAll(): readonly ["auth", "admin", "staff-roles"];
  adminAudit(query: string): readonly ["auth", "admin", "audit", string];
} = {
  all: [ROOT],
  capabilities: () => [ROOT, "capabilities"],
  me: () => [ROOT, "me"],
  securityStatus: () => [ROOT, "security", "status"],
  passwordMethods: () => [ROOT, "password", "methods"],
  sessions: () => [ROOT, "sessions"],
  passkeys: () => [ROOT, "passkeys"],
  oauthLinks: () => [ROOT, "oauth", "links"],
  audit: (page) => [ROOT, "audit", page],
  delayedChange: (channel) => [ROOT, "change", "delayed", channel],
  totpDelayedChange: () => [ROOT, "totp", "change", "delayed"],
  ssoLookup: (domain) => [ROOT, "sso", "lookup", domain],
  verificationPreferences: () => [ROOT, "verification", "preferences"],
  // The operator console sits under one `admin` segment so a host can drop the
  // whole staff surface from the cache in a single `removeQueries` when a
  // person's staff role goes away mid-session.
  ssoOrgs: () => [ROOT, "admin", "sso", "orgs"],
  ssoOrg: (slug) => [ROOT, "admin", "sso", "orgs", slug],
  ssoOrgConfig: (slug) => [ROOT, "admin", "sso", "orgs", slug, "config"],
  serviceKeys: () => [ROOT, "admin", "service-keys"],
  staffRoles: (userId) => [ROOT, "admin", "staff-roles", userId],
  staffRolesAll: () => [ROOT, "admin", "staff-roles"],
  adminAudit: (query) => [ROOT, "admin", "audit", query],
};
