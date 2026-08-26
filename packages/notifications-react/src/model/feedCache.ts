/**
 * The feed's query cache, and the four things that are ever done to it.
 *
 * Three different callers write read state into the same infinite-query entry:
 * a row that was opened, the "mark all" button, and a `notification.read`
 * frame from another tab. Each of them has to stamp the same rows AND move the
 * same badge, and the badge lives on the page envelope rather than on the rows
 * — so a caller that patched one and forgot the other would leave a list of
 * read rows under a badge that still says 3.
 *
 * The transforms live here, outside `/live`, for two reasons. The optimistic
 * write in `model/mutations.ts` needs exactly the transform the socket frame
 * applies, and `/live` imports `@stapel/realtime` — a polling deployment must
 * not pull a socket runtime in to mark a row read. `/live` re-exports
 * {@link mergeArrivedItem} so its published surface is unchanged.
 *
 * Every function is a pure `cache -> cache`, and every one leaves a cache that
 * has never been read (`undefined`, or zero pages) alone: the first
 * `GET /feed/` carries the truth anyway, and seeding a page from a signal would
 * invent `has_next: false` for a feed nobody has paged.
 */
import type { InfiniteData } from "@tanstack/react-query";
import type { FeedItem, NotificationFeedPage } from "../api/types.js";
import { isFeedItemUnread } from "../api/types.js";

/** The shape `useInfiniteNotificationFeed` keeps under `queryKeys.feed()`. */
export type FeedCache = InfiniteData<NotificationFeedPage, string | undefined>;

/** `unread_count` is a fact about the whole feed, so it is the same number on
 * every loaded page — set it on all of them or the badge depends on which page
 * a reader happens to be looking at. */
function withUnreadCount(
  cache: FeedCache,
  pages: readonly NotificationFeedPage[],
  unreadCount: number
): FeedCache {
  return {
    ...cache,
    pages: pages.map((page) => ({ ...page, unread_count: unreadCount })),
  };
}

/**
 * Put an arriving row at the top of the newest page.
 *
 * Upsert by `id`, never by position: the same delivery can reach a tab twice
 * (a socket frame and a poll that raced it), and a list that appended blindly
 * would show it twice.
 *
 * An arriving row is unread by definition — it has just been delivered — so
 * the badge goes up with it. Before 0.18.0 there was no badge and this
 * function only touched `count`.
 */
export function mergeArrivedItem(
  cache: FeedCache | undefined,
  item: FeedItem
): FeedCache | undefined {
  if (cache === undefined || cache.pages.length === 0) return cache;
  const already = cache.pages.some((page) =>
    page.items.some((existing) => existing.id === item.id)
  );
  if (already) return cache;
  const [newest, ...rest] = cache.pages as [
    NotificationFeedPage,
    ...NotificationFeedPage[],
  ];
  const unread = newest.unread_count + (isFeedItemUnread(item) ? 1 : 0);
  return withUnreadCount(
    cache,
    [{ ...newest, items: [item, ...newest.items], count: newest.count + 1 }, ...rest],
    unread
  );
}

/** How many of `ids` are rows this cache holds and has not marked read yet. */
function unreadAmong(cache: FeedCache, ids: ReadonlySet<string>): number {
  let n = 0;
  for (const page of cache.pages) {
    for (const item of page.items) {
      if (ids.has(item.id) && isFeedItemUnread(item)) n += 1;
    }
  }
  return n;
}

function stamp(
  cache: FeedCache,
  matches: (item: FeedItem) => boolean,
  readAt: string
): readonly NotificationFeedPage[] {
  return cache.pages.map((page) => ({
    ...page,
    items: page.items.map((item) =>
      matches(item) && isFeedItemUnread(item) ? { ...item, read_at: readAt } : item
    ),
  }));
}

/**
 * The OPTIMISTIC write: stamp the rows this client just asked the server to
 * mark, and move the badge by exactly as many as actually changed.
 *
 * "As many as actually changed" is the whole subtlety. `marked` is the number
 * the server reports, and it counts rows that were UNREAD — so a client that
 * subtracted `ids.length` would drive the badge negative the second time
 * somebody clicked the same already-read row. Counting the unread ones in the
 * cache reproduces the server's arithmetic locally, which is what makes the
 * optimistic number agree with the answer that replaces it.
 *
 * `all: true` sets the badge to 0 rather than subtracting: rows this client has
 * never loaded are read too.
 */
export function markReadLocally(
  cache: FeedCache | undefined,
  target: { readonly ids?: readonly string[] | undefined; readonly all?: true | undefined },
  readAt: string
): FeedCache | undefined {
  if (cache === undefined || cache.pages.length === 0) return cache;
  if (target.all === true) {
    return withUnreadCount(cache, stamp(cache, () => true, readAt), 0);
  }
  const ids = new Set(target.ids ?? []);
  if (ids.size === 0) return cache;
  const moving = unreadAmong(cache, ids);
  if (moving === 0) return cache;
  const current = cache.pages[0]?.unread_count ?? 0;
  return withUnreadCount(
    cache,
    stamp(cache, (item) => ids.has(item.id), readAt),
    Math.max(0, current - moving)
  );
}

/** The `notification.read` frame's payload (stapel-notifications 0.18.0). */
export interface FeedReadSignal {
  /** The rows that just moved. Empty when `all` — a frame is not the place for
   * somebody's whole history. */
  readonly ids: readonly string[];
  /** The whole feed was cleared, including rows this client never loaded. */
  readonly all: boolean;
  /** The badge value that is now true — the server's number, not a delta. */
  readonly unread_count: number;
}

/**
 * Apply a `notification.read` frame — another screen of the same account
 * cleared something, and this tab's badge is now wrong.
 *
 * `unread_count` is taken from the frame verbatim rather than recomputed:
 * it is the server's count over the whole feed, and this cache holds however
 * many pages this tab happened to scroll.
 *
 * The stamp uses the client's clock, because the frame carries no timestamp.
 * That is the one approximation here and it is bounded: `read_at` drives a
 * boolean on screen (dot or no dot), the exact instant arrives with the next
 * `GET feed/`, and the columns on the server were correct the whole time.
 */
export function applyReadSignal(
  cache: FeedCache | undefined,
  signal: FeedReadSignal,
  readAt: string
): FeedCache | undefined {
  if (cache === undefined || cache.pages.length === 0) return cache;
  const ids = new Set(signal.ids);
  const pages = signal.all
    ? stamp(cache, () => true, readAt)
    : stamp(cache, (item) => ids.has(item.id), readAt);
  return withUnreadCount(cache, pages, Math.max(0, signal.unread_count));
}

/**
 * The badge value the loaded pages agree on, or 0 for a cache nobody has read.
 *
 * Reads page zero: every write above keeps the number identical across pages,
 * and the newest page is the one a fresh `GET feed/` always refreshes.
 */
export function unreadCountOf(cache: FeedCache | undefined): number {
  return cache?.pages[0]?.unread_count ?? 0;
}
