import { useCallback } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  mapLoad,
  requireLoaded,
} from "@stapel/core";
import type { ActionAvailability, LoadState, StapelApiError } from "@stapel/core";
import type { FeedItem } from "../api/types.js";
import { isFeedItemUnread } from "../api/types.js";
import { useInfiniteNotificationFeed } from "../model/queries.js";
import { useMarkFeedRead } from "../model/mutations.js";
import { useFeedDelivery } from "../model/delivery.js";
import type { FeedDelivery } from "../model/delivery.js";
import { NOTIFICATIONS_I18N_KEYS } from "../i18n/keys.js";

/** Render-prop bag for {@link NotificationFeed}. */
export interface NotificationFeedBag {
  /**
   * The feed read, as a state a skin cannot flatten: `loading` / `ready` with
   * the items loaded so far (newest first, flattened across pages) / `failed`
   * with the error. Render it with core's `matchList`, whose four arms are
   * all required, so "no notifications yet" can only be said about a load
   * that actually succeeded.
   *
   * This replaced an `items: readonly FeedItem[]` field that was `[]` in all
   * three cases. On 2026-08-09 a list endpoint answered 404 for hours and the
   * screens built on that shape told people they had nothing.
   */
  readonly state: LoadState<readonly FeedItem[]>;
  /** Another page exists after the loaded ones. */
  readonly hasNextPage: boolean;
  /** A next-page fetch is in flight. */
  readonly isFetchingNextPage: boolean;
  /** Load the next page (no-op when `!hasNextPage`). */
  fetchNextPage(): void;
  /** Refetch from the newest page. */
  refetch(): void;
  /**
   * How this tab is being told that something arrived: a socket (`live`) or a
   * 60-second poll of the newest page (`polling`), plus the states in between
   * and the refusal that ends them.
   *
   * A skin MUST render this. The failure it prevents is the one the fleet
   * already shipped once — a transport that quietly degraded and said nothing,
   * so a working feed and a dead one looked identical for months.
   */
  readonly delivery: FeedDelivery;

  // ── read state (stapel-notifications 0.18.0) ──────────────────────────────

  /**
   * Unread rows across the WHOLE feed, not the loaded pages — the badge value,
   * answered by the same request that filled the list.
   *
   * `0` while the read is in flight or failed. That is safe HERE and only
   * here: `markAll` below carries the load state properly, and a badge is
   * drawn from {@link NotificationFeedBag.unreadState} when the difference
   * between "none" and "we don't know" has to show.
   */
  readonly unreadCount: number;
  /** The badge number as a load state, for a skin that draws the outage. */
  readonly unreadState: LoadState<number>;
  /**
   * May "mark everything read" be pressed, and if not, why not — blocked while
   * the feed is loading, blocked with the failure when it failed, and blocked
   * with `notifications.feed.mark_all_read.blocked.none` when there is nothing
   * unread to mark.
   *
   * The last one is the case worth spelling: `POST feed/read/ {all:true}` on an
   * already-read feed is a legal, successful, entirely pointless request that
   * answers `marked: 0`. A person who presses a live button and sees nothing
   * change learns nothing; a button that is off next to the sentence "you're
   * all caught up" has already answered them.
   */
  readonly markAll: ActionAvailability;
  /** Mark every unread row read (`{all: true}` — one `UPDATE`, whatever the
   * size of the feed, including rows this client never loaded). */
  markAllRead(): void;
  /**
   * Mark ONE row read — what a skin calls when the row is opened.
   *
   * A no-op for a row that is already read: the endpoint would answer
   * `marked: 0` and emit no signal, so the request buys nothing and every
   * scroll past a read row would send one.
   */
  markRead(item: FeedItem): void;
  /** A mark-read write is in flight (rows are already stamped — this is for a
   * button's busy state, not for hiding the optimistic result). */
  readonly isMarkingRead: boolean;
  /** The failure of the last mark-read write, after its optimistic stamp was
   * rolled back. `null` when the last one succeeded or none has run. */
  readonly markReadError: StapelApiError | null;
}

/**
 * Headless notification feed — a renderless load-more list. Wires
 * {@link useInfiniteNotificationFeed} and hands a {@link NotificationFeedBag} to
 * `children`; bring your own list/skeleton/empty UI. Zero visual opinion
 * (frontend-standard §2).
 *
 * ```tsx
 * <NotificationFeed>
 *   {({ state, hasNextPage, fetchNextPage }) =>
 *     matchList(state, {
 *       loading: () => <Spinner />,
 *       failed: (error) => <ErrorPanel error={error} />,
 *       empty: () => <NothingYet />,
 *       ready: (items) => <List items={items} />,
 *     })
 *   }
 * </NotificationFeed>
 * ```
 */
export function NotificationFeed(props: {
  limit?: number;
  children: (bag: NotificationFeedBag) => ReactNode;
}): ReactNode {
  const query = useInfiniteNotificationFeed(props.limit);
  const delivery = useFeedDelivery();
  const markRead = useMarkFeedRead();
  const { mutate } = markRead;

  const state = mapLoad(loadStateFromQuery(query), (data) =>
    data.pages.flatMap((page) => page.items)
  );
  const unreadState = mapLoad(
    loadStateFromQuery(query),
    (data) => data.pages[0]?.unread_count ?? 0
  );
  const unreadCount = query.data?.pages[0]?.unread_count ?? 0;

  const markAll: ActionAvailability = requireLoaded(state, () =>
    unreadCount === 0
      ? actionBlocked(NOTIFICATIONS_I18N_KEYS.feedMarkAllBlockedNone)
      : actionAvailable()
  );

  const markAllRead = useCallback(() => {
    mutate({ all: true });
  }, [mutate]);

  const markOneRead = useCallback(
    (item: FeedItem) => {
      if (!isFeedItemUnread(item)) return;
      mutate({ ids: [item.id] });
    },
    [mutate]
  );

  return props.children({
    delivery,
    // The pages are flattened INSIDE the ready arm — a failed or not-yet-run
    // read never produces a list at all.
    state,
    unreadState,
    unreadCount,
    markAll,
    markAllRead,
    markRead: markOneRead,
    isMarkingRead: markRead.isPending,
    markReadError: markRead.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
  });
}
