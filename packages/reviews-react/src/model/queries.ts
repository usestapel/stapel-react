import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  OwnerAggregatesResponse,
  ReviewAggregate,
  ReviewPage,
  ReviewTarget,
} from "../api/types.js";
import { useReviewsApi } from "./context.js";
import { normalizedOwnerKeys, reviewsQueryKeys } from "./queryKeys.js";

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
 * request per card against an endpoint that computes an `AVG` each time. A
 * batch read of many TARGET KEYS exists (`reviews.aggregates_by_keys`) but it
 * is a comm Function for a server-side projection, not an HTTP endpoint — a
 * storefront gets per-card ratings from the composite's projection, embedded
 * in the rows its catalogue module already serves, and renders them with
 * {@link ratingSummary} without calling this at all. A batch read of many
 * OWNER keys is a different axis and IS an HTTP endpoint —
 * {@link useOwnerAggregates}.
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

/** The backend's own ceiling (`services.OWNER_KEYS_MAX`) — chunk at it so a
 * page with more sellers on screen than that never provokes
 * `error.400.reviews_too_many_owner_keys`. */
const OWNER_AGGREGATES_CHUNK = 100;

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

export interface UseOwnerAggregatesOptions {
  /** Narrow the count to one kind of target; omitted, every type counts. */
  readonly targetType?: string;
  readonly enabled?: boolean;
}

/**
 * The rating of many OWNERS in one cached read (stapel-reviews 0.6.0,
 * `POST /reviews/aggregates/by-owner`) — the batched form
 * {@link useReviewAggregate}'s doc comment says does not exist for a TARGET;
 * this is the different axis that does exist, for an OWNER.
 *
 * Three rules, all load-bearing:
 *
 * 1. **One query per distinct, sorted key set.** `ownerKeys` is normalized
 *    (deduped, sorted — {@link normalizedOwnerKeys}) before it becomes part
 *    of the query key, so `["b", "a"]`, `["a", "b"]` and `["a", "b", "a"]`
 *    are the SAME cached read. A page re-rendering with its seller list in a
 *    different order must not refetch, and a caller that pushed the same
 *    seller twice must not double it in the request.
 * 2. **Chunked at the backend's own ceiling, transparently.** More than
 *    {@link OWNER_AGGREGATES_CHUNK} distinct keys is split into that many
 *    ceiling-sized requests and fetched together (`Promise.all`); the merged
 *    map is still ONE query result under ONE cache entry, not one per chunk.
 *    A caller can never provoke `error.400.reviews_too_many_owner_keys`
 *    through this hook — only a direct `ReviewsApi.aggregatesByOwner` caller
 *    that skips it can.
 * 3. **An empty key set makes no request.** Not "makes a request with
 *    `owner_keys: []` and gets back `{}`" — the hook never asks a question
 *    with no owners in it, the same discipline {@link useReviewList} and
 *    {@link useReviewAggregate} apply to an unaddressable target.
 *
 * Pairs with `<ReviewAggregate aggregate={…}>`: feed one entry of the
 * returned map in as `aggregate` to render it with `source: "supplied"` and
 * no per-card request, the same way a host already does with the shop
 * composite's roll-up — see the README section this hook is documented
 * beside.
 */
export function useOwnerAggregates(
  ownerKeys: readonly string[],
  options: UseOwnerAggregatesOptions = {}
): UseQueryResult<OwnerAggregatesResponse, StapelApiError> {
  const api = useReviewsApi();
  const sessionReady = useActiveSessionReady();
  const keys = normalizedOwnerKeys(ownerKeys);
  const targetType = options.targetType;
  return useQuery({
    queryKey: reviewsQueryKeys.ownerAggregates(keys, targetType),
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        chunk(keys, OWNER_AGGREGATES_CHUNK).map((page) =>
          api.aggregatesByOwner(
            {
              ownerKeys: page,
              ...(targetType !== undefined ? { targetType } : {}),
            },
            { signal }
          )
        )
      );
      return Object.assign({}, ...pages) as OwnerAggregatesResponse;
    },
    enabled: sessionReady && keys.length > 0 && (options.enabled ?? true),
  });
}
