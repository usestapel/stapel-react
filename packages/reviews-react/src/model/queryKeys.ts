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
 */
import type { ReviewTarget } from "../api/types.js";

const ROOT = "reviews" as const;

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
};
