import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { FeedItem } from "../api/types.js";
import { useInfiniteNotificationFeed } from "../model/queries.js";

/** Render-prop bag for {@link NotificationFeed}. */
export interface NotificationFeedBag {
  /** All loaded items, newest first (flattened across pages). */
  readonly items: readonly FeedItem[];
  /** First page is loading (no data yet). */
  readonly isLoading: boolean;
  /** The query failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Another page exists after the loaded ones. */
  readonly hasNextPage: boolean;
  /** A next-page fetch is in flight. */
  readonly isFetchingNextPage: boolean;
  /** Load the next page (no-op when `!hasNextPage`). */
  fetchNextPage(): void;
  /** Refetch from the newest page. */
  refetch(): void;
}

/**
 * Headless notification feed — a renderless load-more list. Wires
 * {@link useInfiniteNotificationFeed} and hands a {@link NotificationFeedBag} to
 * `children`; bring your own list/skeleton/empty UI. Zero visual opinion
 * (frontend-standard §2).
 *
 * ```tsx
 * <NotificationFeed>
 *   {({ items, hasNextPage, fetchNextPage }) => ( ... )}
 * </NotificationFeed>
 * ```
 */
export function NotificationFeed(props: {
  limit?: number;
  children: (bag: NotificationFeedBag) => ReactNode;
}): ReactNode {
  const query = useInfiniteNotificationFeed(props.limit);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return props.children({
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
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
