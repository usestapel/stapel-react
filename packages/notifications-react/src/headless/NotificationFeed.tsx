import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { FeedItem } from "../api/types.js";
import { useInfiniteNotificationFeed } from "../model/queries.js";
import { useFeedDelivery } from "../model/delivery.js";
import type { FeedDelivery } from "../model/delivery.js";

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
  return props.children({
    delivery,
    // The pages are flattened INSIDE the ready arm — a failed or not-yet-run
    // read never produces a list at all.
    state: mapLoad(loadStateFromQuery(query), (data) =>
      data.pages.flatMap((page) => page.items)
    ),
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
