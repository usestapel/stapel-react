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
 * ── Both reads are ANONYMOUS, and both still wait for the session ─────────
 *
 * Since stapel-reviews 0.3.0 a guest reads the list (`IsAuthenticatedOrReadOnly`)
 * and the aggregate (`AllowAny`), so a public listing page shows its reviews
 * to a visitor who will never sign in. Neither hook carries a
 * "sign in first" state any more — that is now only true of the write.
 *
 * They are still gated on {@link useActiveSessionReady}, and the reason got
 * STRONGER rather than weaker with the permission change. What the server
 * returns depends on who is asking: a moderator of the target gets pending
 * and hidden rows for `include=all`, everyone else is silently narrowed to
 * published. A read that races a still-bootstrapping session would therefore
 * succeed — as a guest — and CACHE that answer under a key that does not
 * mention identity. Before 0.3.0 the same race produced a 401, which was at
 * least visible; a silently narrowed page is not. `useActiveSessionReady()`
 * returns `true` the instant the session settles into any of
 * authenticated / anonymous / unauthenticated, and immediately when no
 * session-owning module is mounted at all — so a purely public storefront
 * waits for nothing.
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
