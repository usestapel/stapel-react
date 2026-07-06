import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
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
 */
export function useNotificationFeed(
  params?: NotificationFeedParams
): UseQueryResult<NotificationFeedPage, StapelApiError> {
  const api = useNotificationsApi();
  const p = params ?? {};
  return useQuery({
    queryKey: notificationsQueryKeys.feedPage(p),
    queryFn: () => api.feed(p),
  });
}

/**
 * The notification feed as an infinite (load-more) list. Follows the backend's
 * anchor pagination: each page advances via its `next_anchor` while `has_next`
 * holds. `data.pages.flatMap(p => p.items)` is the flat item list.
 */
export function useInfiniteNotificationFeed(
  limit?: number
): UseInfiniteQueryResult<
  InfiniteData<NotificationFeedPage, string | undefined>,
  StapelApiError
> {
  const api = useNotificationsApi();
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
  });
}
