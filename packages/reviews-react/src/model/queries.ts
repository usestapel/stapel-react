import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  ReviewAggregate,
  ReviewPage,
  ReviewTarget,
} from "../api/types.js";
import { useReviewsApi } from "./context.js";
import { reviewsQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the reviews API.
 *
 * ── Why they fire even for a visitor who will certainly get 401 ────────────
 *
 * `useActiveSessionStatus()` could tell us the session settled as anonymous,
 * and skipping the request would save a round trip per listing page. The
 * hooks do not do that, on the same rule cdn-react's limit mirror follows: a
 * client-side gate must not refuse what the server would have allowed. The
 * mapping from "anonymous session" to "401 from stapel-reviews" is a
 * deployment's business — a host can put a reverse proxy, a guest-token
 * exchange or a relaxed permission class in between — and a pair that decided
 * locally would make the reviews permanently invisible on the day that
 * changed, with nothing in the network tab to explain it.
 *
 * What the pair does instead is refuse to MISREPRESENT the refusal:
 * `isSignInRequired(error)` (`model/refusals.ts`) is a named state the bags
 * carry, so the skin says "sign in to read the reviews" instead of "no
 * reviews yet".
 *
 * Both hooks are gated on {@link useActiveSessionReady}, which is a different
 * question: a read that races a still-bootstrapping session reports its
 * answer for the length of the bootstrap, and here that answer would be the
 * 401.
 */

/** Default page size for the review list — one screenful. */
export const REVIEWS_PAGE = 20;

export interface UseReviewListOptions {
  /**
   * Ask for pending/hidden rows too — honoured only for a moderator/owner of
   * the target, and narrowed to published for anyone else WITHOUT an error.
   * Part of the query key, because it selects a different set of rows.
   */
  readonly include?: "all";
  readonly limit?: number;
  /** Set `false` to hold the read (e.g. the target id is not resolved yet). */
  readonly enabled?: boolean;
}

/**
 * A target's reviews as an infinite (load-more) list, newest first.
 *
 * Pages are core's `AnchorPagination` envelope — which the schema does not
 * declare (`api/types.ts`) — and the cursor is the previous page's
 * `next_anchor`, a `created_at` timestamp. `has_next` is the authority on
 * whether another page exists; a `next_anchor` is only read when it says yes,
 * because the paginator leaves the anchor `null` on the last page and a
 * cursor derived from the last row instead would re-request it forever.
 */
export function useReviewList(
  target: ReviewTarget,
  options: UseReviewListOptions = {}
): UseInfiniteQueryResult<
  InfiniteData<ReviewPage, string | undefined>,
  StapelApiError
> {
  const api = useReviewsApi();
  const sessionReady = useActiveSessionReady();
  const limit = options.limit ?? REVIEWS_PAGE;
  const addressable =
    target.targetType.length > 0 && target.targetKey.length > 0;
  return useInfiniteQuery({
    queryKey: reviewsQueryKeys.list(target, options.include),
    queryFn: ({ pageParam, signal }) =>
      api.reviews(
        {
          ...target,
          ...(options.include !== undefined ? { include: options.include } : {}),
          direction: "next",
          limit,
          ...(pageParam !== undefined ? { anchor: pageParam } : {}),
        },
        { signal }
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.has_next ? (last.next_anchor ?? undefined) : undefined,
    enabled: sessionReady && addressable && (options.enabled ?? true),
  });
}

/**
 * The module-owned aggregate for one target.
 *
 * NOT the way to put a rating on every card of a search result: that is one
 * request per card against an endpoint that computes an `AVG` each time. The
 * batch read exists (`reviews.aggregates_by_keys`) but it is a comm Function
 * for a server-side projection, not an HTTP endpoint — a storefront gets
 * per-card ratings from the composite's projection, embedded in the rows its
 * catalogue module already serves, and renders them with
 * {@link ratingSummary} without calling this at all.
 */
export function useReviewAggregate(
  target: ReviewTarget,
  options: { readonly enabled?: boolean } = {}
): UseQueryResult<ReviewAggregate, StapelApiError> {
  const api = useReviewsApi();
  const sessionReady = useActiveSessionReady();
  const addressable =
    target.targetType.length > 0 && target.targetKey.length > 0;
  return useQuery({
    queryKey: reviewsQueryKeys.aggregate(target),
    queryFn: ({ signal }) => api.aggregate(target, { signal }),
    enabled: sessionReady && addressable && (options.enabled ?? true),
  });
}
