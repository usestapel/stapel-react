import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  Blocked,
  Contact,
  ContactAction,
  ContactCreate,
  ContactList,
  ContactReveal,
  ContactRevealRequest,
  ContactRevealSummary,
  ContactUpdate,
  ContactVerifyConfirm,
  ContactVerifyRequest,
  Followers,
  Following,
  Language,
  MyProfile,
  ProfileBatch,
  ProfileBatchRequest,
  ProfileFieldManifestEntry,
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
 * `baseUrl` (e.g. `/profiles/api/v1/`).
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
  /**
   * Many public profiles in one request (stapel-profiles ≥0.8.0, #111) — the
   * same projection {@link getProfile} returns, for up to
   * `PROFILES_BATCH_MAX_IDS` (default 100) ids.
   *
   * POST is the transport, not the semantics: this is a safe, repeatable
   * READ sent as a body because 100 UUIDs overflow the URL ceilings old
   * proxies still enforce (and keep the roster of who is being looked at out
   * of access logs).
   *
   * The reply splits `profiles` from `missing`; over the limit it is REFUSED
   * with `error.400.too_many_ids` carrying both numbers, never silently
   * truncated.
   */
  batchProfiles(userIds: readonly string[]): Promise<ProfileBatch>;
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
  /**
   * The active profile field manifest (§66 "Owner Addendum" tier 1,
   * data-driven default skin) — identity preset + standard_fields +
   * custom_fields, in declaration order. Public (no auth required — the
   * skin needs it before login too), like {@link listLanguages}.
   */
  getFieldManifest(): Promise<readonly ProfileFieldManifestEntry[]>;

  // ── contacts (stapel-profiles ≥0.20.0) ─────────────────────────────────────

  /** The caller's own contacts + the policy vocabulary this deployment offers. */
  listContacts(): Promise<ContactList>;
  /** Store a number for the caller. It starts UNVERIFIED — and an unverified
   * number is revealed to nobody until `verify/confirm` has run. */
  addContact(body: ContactCreate): Promise<Contact>;
  /** Change a contact's label, policy or on/off switch. Somebody else's
   * contact answers 404 — a contact is not a public object. */
  updateContact(contactId: number, patch: ContactUpdate): Promise<Contact>;
  /** Delete a contact and its journal. */
  removeContact(contactId: number): Promise<ContactAction>;
  /** Ask the OTP provider to send a code to this number. */
  requestContactCode(contactId: number): Promise<ContactVerifyRequest>;
  /** Confirm the code — the moment the number becomes revealable. */
  confirmContactCode(contactId: number, code: string): Promise<Contact>;
  /** Hand-over counters for ONE of the caller's own numbers. Counts only:
   * WHO asked is the viewers' data, and this endpoint does not trade it. */
  getContactRevealSummary(contactId: number): Promise<ContactRevealSummary>;
  /**
   * Ask for a seller's numbers — the ONE endpoint that hands a number over,
   * per the policy on each number, journalled and budgeted.
   *
   * POST is the transport AND the semantics: every call is a hand-over the
   * owner is entitled to see. A caller without an account (signed out OR a
   * guest session) gets 403 `error.403.contacts_registration_required`; over
   * the hourly budget, 429 `error.429.contacts_reveal_budget` with
   * `retry_after`. The answer carries `Cache-Control: no-store`, and this
   * pair keeps it out of the query cache to match (see `useRevealContacts`).
   */
  revealContacts(body: ContactRevealRequest): Promise<ContactReveal>;
}

export function createProfilesApi(client: StapelClient): ProfilesApi {
  return {
    client,

    getMyProfile: () => client.get("/me"),

    updateMyProfile: (patch) =>
      client.patch("/me", patch satisfies ProfileUpdate, mutating()),

    getProfile: (userId) => client.get(`/${seg(userId)}`),

    batchProfiles: (userIds) =>
      client.post(
        "/batch",
        { user_ids: [...userIds] } satisfies ProfileBatchRequest,
        mutating()
      ),

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

    getFieldManifest: () => client.get("/field-manifest"),

    listContacts: () => client.get("/contacts"),

    addContact: (body) =>
      client.post("/contacts", body satisfies ContactCreate, mutating()),

    updateContact: (contactId, patch) =>
      client.patch(
        `/contacts/${contactId}`,
        patch satisfies ContactUpdate,
        mutating()
      ),

    removeContact: (contactId) =>
      client.delete(`/contacts/${contactId}`, mutating()),

    requestContactCode: (contactId) =>
      client.post(`/contacts/${contactId}/verify/request`, undefined, mutating()),

    confirmContactCode: (contactId, code) =>
      client.post(
        `/contacts/${contactId}/verify/confirm`,
        { code } satisfies ContactVerifyConfirm,
        mutating()
      ),

    getContactRevealSummary: (contactId) =>
      client.get(`/contacts/${contactId}/reveals/summary`),

    revealContacts: (body) =>
      client.post("/contacts/reveal", body satisfies ContactRevealRequest, mutating()),
  };
}
