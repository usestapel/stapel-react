import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  DeviceListItem,
  NotificationFeedPage,
  NotificationFeedParams,
} from "../api/types.js";
import { useNotificationsApi } from "./context.js";
import { notificationsQueryKeys } from "./queryKeys.js";
import { feedPollInterval, useFeedDelivery, usePageVisible } from "./delivery.js";

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
 * holds. Flatten the pages behind a `LoadState` (see `NotificationFeed`), not
 * into a bare array. Gated on session readiness — see
 * {@link useNotificationFeed}.
 *
 * ── Freshness is wired here, once, and it is stated on screen ─────────────
 *
 * With a socket (`@stapel/notifications-react/live`) new rows arrive as frames
 * and this query never polls. Without one it refetches the newest page every
 * 60 seconds **while the tab is visible and not at all while it is hidden**,
 * and refetches on focus so the wait after coming back is zero — the interval
 * and the reasoning are stapel-notifications MODULE.md § "Live feed", not a
 * number chosen here. Either way `useFeedDelivery()` reports which one is
 * running, and the default skin draws it: a feed that silently stopped
 * updating is indistinguishable from a feed with nothing in it.
 */
export function useInfiniteNotificationFeed(
  limit?: number
): UseInfiniteQueryResult<
  InfiniteData<NotificationFeedPage, string | undefined>,
  StapelApiError
> {
  const api = useNotificationsApi();
  const sessionReady = useActiveSessionReady();
  const { mode } = useFeedDelivery();
  const visible = usePageVisible();
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
    refetchInterval: feedPollInterval(mode, visible),
    // A hidden tab is never polled, so the interval alone would leave a
    // returning reader looking at whatever was on screen when they left.
    refetchOnWindowFocus: true,
  });
}

/**
 * The caller's registered push devices — the read that lets a toggle tell the
 * truth (stapel-notifications 0.17.0, `GET /devices/`).
 *
 * Before this endpoint existed no client could answer "is push on for this
 * device?", so every toggle in the fleet rendered OFF on mount and — holding
 * no token after a reload — switching it off sent no request at all while
 * saying it had. Both device mutations invalidate this key, so the switch's
 * position is always the server's answer and never a local guess.
 *
 * Gated on session readiness for the same reason as the feed.
 */
export function useDevices(): UseQueryResult<
  readonly DeviceListItem[],
  StapelApiError
> {
  const api = useNotificationsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: notificationsQueryKeys.devices(),
    queryFn: () => api.listDevices(),
    enabled: sessionReady,
  });
}
