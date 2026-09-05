/**
 * Namespaced TanStack Query keys (frontend-standard §2). Everything under the
 * `"reviews"` root so a host can invalidate the whole module, one target, or
 * one read.
 *
 * THE TARGET IS TWO STRINGS, AND BOTH ARE IN THE KEY. `target_key` alone is
 * not an identity: the module groups by the PAIR, and two deployments'
 * registries can key different things with the same opaque string (a listing
 * `"42"` and a course `"42"`). A key built from `target_key` only would serve
 * one target's reviews for the other.
 *
 * `include` is part of the list key for the same reason: `include=all` is a
 * DIFFERENT set of rows (pending and hidden ones), and folding it into the
 * published-only entry would let a moderator's window overwrite what every
 * other reader sees.
 *
 * `ownerAggregates` keys on the DISTINCT, SORTED set of owner keys rather
 * than the caller's raw array — order and duplicates in `ownerKeys` must not
 * split one batched read into two cache entries, since `useOwnerAggregates`
 * exists precisely so a page with the same sellers on screen twice fires one
 * request, not two.
 */
import type { ReviewTarget } from "../api/types.js";

const ROOT = "reviews" as const;

/** The distinct owner keys, sorted — the set `useOwnerAggregates` actually
 * requests and keys its cache entry on, so `["b","a"]` and `["a","b","a"]`
 * are the same query. Exported for the hook to reuse: computing it twice
 * (once for the key, once for the request) would let the two drift. */
export function normalizedOwnerKeys(ownerKeys: readonly string[]): readonly string[] {
  return Array.from(new Set(ownerKeys)).sort();
}

export const reviewsQueryKeys: {
  readonly all: readonly ["reviews"];
  /** Everything cached about one target. */
  target(target: ReviewTarget): readonly ["reviews", string, string];
  /** The anchor-paginated list window for one target and one visibility scope. */
  list(
    target: ReviewTarget,
    include?: "all"
  ): readonly ["reviews", string, string, "list", string];
  /** The module-owned aggregate for one target. */
  aggregate(
    target: ReviewTarget
  ): readonly ["reviews", string, string, "aggregate"];
  /**
   * The batched owner-aggregate read for one distinct, order-independent set
   * of owner keys and one optional `targetType` narrowing. NOT under
   * `target()` — this is not about one `(target_type, target_key)` pair, it
   * is about however many owners a page asked for in one call.
   */
  ownerAggregates(
    ownerKeys: readonly string[],
    targetType?: string
  ): readonly ["reviews", "ownerAggregates", string, string];
} = {
  all: [ROOT],
  target: (target) => [ROOT, target.targetType, target.targetKey],
  list: (target, include) => [
    ROOT,
    target.targetType,
    target.targetKey,
    "list",
    include ?? "published",
  ],
  aggregate: (target) => [ROOT, target.targetType, target.targetKey, "aggregate"],
  ownerAggregates: (ownerKeys, targetType) => [
    ROOT,
    "ownerAggregates",
    targetType ?? "",
    JSON.stringify(normalizedOwnerKeys(ownerKeys)),
  ],
};
