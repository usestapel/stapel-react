/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"profiles"` root so a host can invalidate the whole
 * module or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 */
const ROOT = "profiles" as const;

export const profilesQueryKeys: {
  readonly all: readonly ["profiles"];
  me(): readonly ["profiles", "me"];
  profile(userId: string): readonly ["profiles", "profile", string];
  batch(userIds: readonly string[]): readonly [
    "profiles",
    "batch",
    readonly string[],
  ];
  relationship(userId: string): readonly ["profiles", "relationship", string];
  followers(): readonly ["profiles", "followers"];
  following(): readonly ["profiles", "following"];
  blocked(): readonly ["profiles", "blocked"];
  languages(): readonly ["profiles", "languages"];
  fieldManifest(): readonly ["profiles", "fieldManifest"];
  contacts(): readonly ["profiles", "contacts"];
  contactRevealSummary(contactId: number): readonly [
    "profiles",
    "contacts",
    "revealSummary",
    number,
  ];
} = {
  all: [ROOT],
  me: () => [ROOT, "me"],
  profile: (userId) => [ROOT, "profile", userId],
  // The id list IS the key: two different rosters are two different answers,
  // and the same roster asked twice must hit one cache entry. De-duplicated
  // and sorted by the hook, so tile order never forks the cache.
  batch: (userIds) => [ROOT, "batch", userIds],
  relationship: (userId) => [ROOT, "relationship", userId],
  followers: () => [ROOT, "followers"],
  following: () => [ROOT, "following"],
  blocked: () => [ROOT, "blocked"],
  languages: () => [ROOT, "languages"],
  fieldManifest: () => [ROOT, "fieldManifest"],
  // The owner's OWN contacts. There is deliberately no key for a REVEAL: that
  // answer is per-viewer, budgeted and journalled, the wire sends it with
  // `Cache-Control: no-store`, and a query entry would be a second copy of a
  // stranger's phone number living past the screen that asked for it (see
  // `useRevealContacts`).
  contacts: () => [ROOT, "contacts"],
  // Under the contacts root on purpose: invalidating `contacts()` takes the
  // counters with it, which is what a delete or a fresh hand-over means.
  contactRevealSummary: (contactId) => [
    ROOT,
    "contacts",
    "revealSummary",
    contactId,
  ],
};
