import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  Blocked,
  Followers,
  Following,
  Language,
  MyProfile,
  ProfileUpdate,
  PublicProfile,
  RelationshipAction,
  RelationshipInfo,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors auth-react): the
 * simplest SPA rule is to always send `X-Requested-With: XMLHttpRequest` on
 * mutating requests. Header-token clients ignore it; it is harmless there, so
 * every mutation carries it.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/** URL-safe path segment for a user id (a UUID, but guarded defensively). */
function seg(userId: string): string {
  return encodeURIComponent(userId);
}

/**
 * The pair's typed operation surface — one method per stapel-profiles endpoint a
 * JS client may call, bound to the injected {@link StapelClient} (the per-module
 * override seam of frontend-standard §7.2). Paths are relative to the runtime's
 * `baseUrl` (e.g. `/profiles/api/`).
 *
 * The token-based `POST /notifications/unsubscribe` (one-click email unsubscribe)
 * is intentionally absent — it is a public, token-authenticated email surface,
 * not part of the signed-in profile UI this pair drives, and the backend types
 * its body as a bare object.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2 (task `core-typed-ops`); until then they are hand-authored here (the ONE
 * legal home of path strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface ProfilesApi {
  readonly client: StapelClient;

  /** The caller's own, full profile (all settings). */
  getMyProfile(): Promise<MyProfile>;
  /** Partially update the caller's profile — returns the updated profile. */
  updateMyProfile(patch: ProfileUpdate): Promise<MyProfile>;
  /** Another user's public profile projection (includes relationship_status). */
  getProfile(userId: string): Promise<PublicProfile>;
  /** The caller↔target relationship status. */
  getRelationship(userId: string): Promise<RelationshipInfo>;
  /** Follow a user — returns the new relationship status. */
  follow(userId: string): Promise<RelationshipAction>;
  /** Unfollow a user — returns the new relationship status. */
  unfollow(userId: string): Promise<RelationshipAction>;
  /** Block a user — returns the new relationship status. */
  block(userId: string): Promise<RelationshipAction>;
  /** Unblock a user — returns the new relationship status. */
  unblock(userId: string): Promise<RelationshipAction>;
  /** The caller's followers (user ids + count). */
  getMyFollowers(): Promise<Followers>;
  /** The users the caller follows (user ids + count). */
  getMyFollowing(): Promise<Following>;
  /** The users the caller has blocked (user ids). */
  getMyBlocked(): Promise<Blocked>;
  /** The supported UI languages (reference list). */
  listLanguages(): Promise<readonly Language[]>;
}

export function createProfilesApi(client: StapelClient): ProfilesApi {
  return {
    client,

    getMyProfile: () => client.get("/me"),

    updateMyProfile: (patch) =>
      client.patch("/me", patch satisfies ProfileUpdate, mutating()),

    getProfile: (userId) => client.get(`/${seg(userId)}`),

    getRelationship: (userId) => client.get(`/${seg(userId)}/relationship`),

    follow: (userId) =>
      client.post(`/${seg(userId)}/follow`, undefined, mutating()),

    unfollow: (userId) =>
      client.post(`/${seg(userId)}/unfollow`, undefined, mutating()),

    block: (userId) =>
      client.post(`/${seg(userId)}/block`, undefined, mutating()),

    unblock: (userId) =>
      client.post(`/${seg(userId)}/unblock`, undefined, mutating()),

    getMyFollowers: () => client.get("/me/followers"),

    getMyFollowing: () => client.get("/me/following"),

    getMyBlocked: () => client.get("/me/blocked"),

    listLanguages: () => client.get("/languages/"),
  };
}
