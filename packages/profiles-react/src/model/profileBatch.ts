/**
 * Reading a batch answer WITHOUT losing the distinction it exists to make
 * (stapel-profiles #111).
 *
 * `POST /batch` splits its answer in two on purpose:
 *
 * * id in `profiles` — there is a profile, here it is;
 * * id in `missing` — asked about, none exists. A NORMAL state (nobody has
 *   opened settings yet), not a failure: render the placeholder, cache the
 *   negative, do not retry, nothing is broken;
 * * id in NEITHER — it was not part of this request.
 *
 * A lookup that answers `undefined` for the last two folds them together, and
 * folding them together is precisely the defect the endpoint was built to
 * remove: it is what turned a 16-tile contact grid into 16 red console lines,
 * because "no profile row" was indistinguishable from "something went wrong".
 * So the lookup here is a four-state answer, never a nullable profile.
 */
import type { ProfileBatch, PublicProfile } from "../api/types.js";

/**
 * What one user id resolves to in a batch answer.
 *
 * `unknown` (no answer yet — still loading, or the batch failed) is kept
 * apart from `not_requested` for the same reason `missing` is kept apart
 * from both: a placeholder, a spinner and a bug are three different things
 * on the screen.
 */
export type ProfileBatchEntry =
  | { readonly status: "found"; readonly profile: PublicProfile }
  | { readonly status: "missing"; readonly profile: null }
  | { readonly status: "not_requested"; readonly profile: null }
  | { readonly status: "unknown"; readonly profile: null };

/**
 * Resolve one user id against a batch answer.
 *
 * Pass the query's `data` straight in — `undefined` (nothing fetched yet)
 * answers `unknown`, which is NOT the same as `missing`.
 */
export function profileBatchEntry(
  batch: ProfileBatch | undefined | null,
  userId: string
): ProfileBatchEntry {
  if (!batch) return { status: "unknown", profile: null };
  const found = batch.profiles?.find((p) => p.user_id === userId);
  if (found) return { status: "found", profile: found };
  if (batch.missing?.includes(userId)) {
    return { status: "missing", profile: null };
  }
  return { status: "not_requested", profile: null };
}

/**
 * The found profiles keyed by user id — the shape a grid zips back onto its
 * tiles. Deliberately holds ONLY the found ones: a map cannot express
 * "missing" apart from "not asked", so anything that needs the distinction
 * goes through {@link profileBatchEntry}.
 */
export function profileBatchById(
  batch: ProfileBatch | undefined | null
): ReadonlyMap<string, PublicProfile> {
  const byId = new Map<string, PublicProfile>();
  for (const profile of batch?.profiles ?? []) {
    if (typeof profile.user_id === "string") byId.set(profile.user_id, profile);
  }
  return byId;
}

/**
 * The backend's default `PROFILES_BATCH_MAX_IDS`. A deployment may raise or
 * lower it, so this is a CHUNKING hint, not a rule: going over is refused
 * with `error.400.too_many_ids`, which carries the real `limit` alongside the
 * `requested` count — chunk by that, not by this.
 */
export const PROFILE_BATCH_MAX_IDS_DEFAULT = 100;
