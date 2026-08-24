/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"recordings"` root so a host can invalidate the whole
 * module or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 *
 * Mutations invalidate `all` (the whole module) rather than a narrow key: a
 * created recording or a finalize both shift the list AND a detail read at once,
 * so the broad invalidation keeps every cached read honest without the pair
 * guessing which entries changed.
 *
 * THE SHARE KEYS ARE NOT UNDER `all`. A share view is an anonymous surface
 * keyed by a link token, read with no session; folding it under the owner's
 * root would let a `logout` wipe (or an owner-side invalidate) reach into a
 * public page that has nothing to do with the account.
 */
import type { RecordingListParams, TranscriptParams } from "../api/types.js";

const ROOT = "recordings" as const;
const SHARE_ROOT = "recording-shares" as const;

export const recordingsQueryKeys: {
  readonly all: readonly ["recordings"];
  readonly allShares: readonly ["recording-shares"];
  list(
    params: RecordingListParams
  ): readonly ["recordings", "list", RecordingListParams];
  detail(recordingId: string): readonly ["recordings", "detail", string];
  media(recordingId: string): readonly ["recordings", "media", string];
  transcript(
    recordingId: string,
    params: TranscriptParams
  ): readonly ["recordings", "transcript", string, TranscriptParams];
  share(
    linkToken: string,
    unlockToken: string | null
  ): readonly ["recording-shares", "detail", string, string | null];
  shareMedia(
    linkToken: string,
    unlockToken: string | null
  ): readonly ["recording-shares", "media", string, string | null];
} = {
  all: [ROOT],
  allShares: [SHARE_ROOT],
  // The list key carries its params so the own-recordings view and a
  // per-workspace view are cached distinctly (a workspace filter is a different
  // read surface, not the same list).
  list: (params) => [ROOT, "list", params],
  detail: (recordingId) => [ROOT, "detail", recordingId],
  // The media URL is a short-lived credential, not a property of the recording:
  // its own key so re-minting it does not churn the detail read, and so a
  // detail invalidation does not throw away a URL that is still valid.
  media: (recordingId) => [ROOT, "media", recordingId],
  transcript: (recordingId, params) => [ROOT, "transcript", recordingId, params],
  // The unlock token is part of the key, not a header the cache cannot see: a
  // locked read and an unlocked read of the same link are DIFFERENT payloads
  // (the projection follows the grant), and one must not be served from the
  // other's cache entry.
  share: (linkToken, unlockToken) => [SHARE_ROOT, "detail", linkToken, unlockToken],
  shareMedia: (linkToken, unlockToken) => [
    SHARE_ROOT,
    "media",
    linkToken,
    unlockToken,
  ],
};
