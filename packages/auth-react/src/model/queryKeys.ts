/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "ключи неймспейснуты").
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
  ssoLookup(domain: string): readonly ["auth", "sso", "lookup", string];
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
  ssoLookup: (domain) => [ROOT, "sso", "lookup", domain],
};
