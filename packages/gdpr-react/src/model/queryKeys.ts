/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "keys are
 * namespaced"). Everything under the `"gdpr"` root so a host can invalidate
 * the whole module, one subject area, or one row. Persist scope is per-user
 * via core's query runtime (`setPersistUser`). Explicit tuple return types
 * satisfy `--isolatedDeclarations`.
 *
 * ── Nothing here is keyed by a user id, and that is deliberate ────────────
 *
 * Every read on this surface is "mine" (`/user/account/close/status`,
 * `/user/data-export/status`, `/me/erasures`) or staff-wide (`/dsar`,
 * `/owners/health`). The server decides whose data that is from the session,
 * so a key carrying a user id would be a second, client-side answer to a
 * question the server already answered — and the moment the two disagreed
 * (an account switch, a token that outlived a logout) the cache would serve
 * one person's deletion state to another. Core's query runtime already
 * partitions the persisted cache per user; the sign-out path clears it.
 *
 * ── Why the mutations invalidate ACROSS these entries ────────────────────
 *
 * Closing an account creates an erasure at grace end; a DSAR of kind
 * `erasure` starts a closure and one of kind `access` starts an export. The
 * write endpoints are separate but the STATE is one machine, so the mutations
 * invalidate `all` rather than pretending to know which of the three screens
 * the server just moved.
 */
const ROOT = "gdpr" as const;

export const gdprQueryKeys: {
  /** Everything this module caches — the one invalidation a host needs. */
  readonly all: readonly ["gdpr"];
  /** The caller's account-closure state (the 404-as-null read). */
  readonly closure: readonly ["gdpr", "closure"];
  /** Every erasure read. */
  readonly erasures: readonly ["gdpr", "erasures"];
  /** The caller's own erasures — the "waiting to be deleted" list. */
  readonly myErasures: readonly ["gdpr", "erasures", "mine"];
  /** One erasure by id, with its receipts and processor windows. */
  erasure(requestId: number): readonly ["gdpr", "erasures", "one", number];
  /** The caller's data-export state (the other 404-as-null read). */
  readonly exportStatus: readonly ["gdpr", "export", "status"];
  /** Every DSAR read. */
  readonly dsar: readonly ["gdpr", "dsar"];
  /** The staff queue. */
  readonly dsarQueue: readonly ["gdpr", "dsar", "queue"];
  /** One DSAR by id. */
  dsarOne(dsarId: number): readonly ["gdpr", "dsar", "one", number];
  /** The data-owner liveness table (staff). */
  readonly ownersHealth: readonly ["gdpr", "owners", "health"];
} = {
  all: [ROOT],
  closure: [ROOT, "closure"],
  erasures: [ROOT, "erasures"],
  myErasures: [ROOT, "erasures", "mine"],
  erasure: (requestId) => [ROOT, "erasures", "one", requestId],
  exportStatus: [ROOT, "export", "status"],
  dsar: [ROOT, "dsar"],
  dsarQueue: [ROOT, "dsar", "queue"],
  dsarOne: (dsarId) => [ROOT, "dsar", "one", dsarId],
  ownersHealth: [ROOT, "owners", "health"],
};
