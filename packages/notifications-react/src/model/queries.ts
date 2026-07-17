import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  NotificationFeedPage,
  NotificationFeedParams,
} from "../api/types.js";
import { useNotificationsApi } from "./context.js";
import { notificationsQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the notifications API. Staleness follows core's query
 * defaults; override per call site via a page that needs fresher data. Keys are
 * namespaced (see `notificationsQueryKeys`).
 */

/**
 * A single page of the notification feed (frontend-standard §2 — read hook).
 * Pass `{ anchor, direction }` to jump to a specific page; omit for the newest.
 * For scroll-to-load-more use {@link useInfiniteNotificationFeed} instead.
 *
 * Gated on {@link useActiveSessionReady} (owner-diagnosed live incident,
 * 2026-07-17): the caller's own feed has no natural `enabled` condition of
 * its own — a top-level hook shaped exactly like the one that raced a
 * still-bootstrapping session and read a live one as "expired". Zero manual
 * `enabled` wiring needed at the call site by design.
 */
export function useNotificationFeed(
  params?: NotificationFeedParams
): UseQueryResult<NotificationFeedPage, StapelApiError> {
  const api = useNotificationsApi();
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: notificationsQueryKeys.feedPage(p),
    queryFn: () => api.feed(p),
    enabled: sessionReady,
  });
}

/**
 * The notification feed as an infinite (load-more) list. Follows the backend's
 * anchor pagination: each page advances via its `next_anchor` while `has_next`
 * holds. `data.pages.flatMap(p => p.items)` is the flat item list. Gated on
 * session readiness — see {@link useNotificationFeed}.
 */
export function useInfiniteNotificationFeed(
  limit?: number
): UseInfiniteQueryResult<
  InfiniteData<NotificationFeedPage, string | undefined>,
  StapelApiError
> {
  const api = useNotificationsApi();
  const sessionReady = useActiveSessionReady();
  return useInfiniteQuery({
    queryKey: notificationsQueryKeys.feed(),
    queryFn: ({ pageParam }) =>
      api.feed({
        direction: "next",
        ...(limit !== undefined ? { limit } : {}),
        ...(pageParam !== undefined ? { anchor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.has_next ? (last.next_anchor ?? undefined) : undefined,
    enabled: sessionReady,
  });
}
