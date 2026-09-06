import { useCallback } from "react";
import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { RealtimeStreamStatus } from "@stapel/realtime";
import type { NoProviderStatus } from "@stapel/realtime/react";
import type { Conversation } from "../api/types.js";
import { useConversations } from "../model/queries.js";
import type { ChatInboxView } from "../model/inboxQuery.js";
import { chatQueryKeys } from "../model/queryKeys.js";
import {
  CONVERSATION_LIST_INTERVAL_MS,
  useChatFreshness,
} from "../flows/freshness.js";
import type {
  ChatDegraded,
  ChatSignal,
  ChatTransport,
} from "../flows/freshness.js";
import { chatInboxStream } from "../realtime/streams.js";

/** Render-prop bag for {@link ConversationList}. */
export interface ConversationListBag {
  /**
   * The list, as a state a skin cannot flatten: `loading` / `ready` with the
   * conversations loaded so far (most recent activity first) / `failed`.
   * Render it with core's `matchList`.
   */
  readonly state: LoadState<readonly Conversation[]>;
  /**
   * Unread messages across the LOADED pages, as its own load state — a badge
   * must not read "0" while the list is failing to load. Server-computed per
   * conversation (`unread_count`), summed here; a host that pages deeper sees
   * the number grow, which is honest for a badge over a paginated list.
   *
   * IT IS A SUM OVER THIS LIST, filter included. A `search` narrows the rows,
   * so it narrows this number too — which is right for "unread in what you
   * are looking at" and wrong for a global unread badge. A host that wants
   * the second one reads an unfiltered list.
   */
  readonly unreadTotal: LoadState<number>;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  fetchNextPage(): void;
  refetch(): void;
  /** Which transport is keeping this list fresh. */
  readonly transport: ChatTransport;
  /** The substrate's own stream state, unflattened. */
  readonly status: RealtimeStreamStatus | NoProviderStatus;
  /**
   * Why it is not a socket, when it is not. The inbox HAS one since
   * stapel-chat 0.4.0 (`ws/chat/inbox`, stream `chat:user:<id>`), so the
   * honest answers here are the same as the thread's — plus `no_socket` for a
   * host that has not told this list who is reading it, since the stream key
   * is the viewer's own and cannot be guessed. Always reported: "this list is
   * on a timer forever" is a fact a person may read and an operator may act
   * on, not a silence.
   */
  readonly degraded: ChatDegraded | null;
  /** Clear a refusal and reconnect — the button beside a visible refusal. */
  reconnect(): void;
}

/**
 * Headless conversation list — a renderless load-more list over
 * `GET /chat/api/v1/conversations`, kept fresh through the transport seam and
 * narrowed, where a host asks for it, by the endpoint's OWN `search` /
 * `unread` filters (stapel-chat 0.8.2).
 *
 * ```tsx
 * <ConversationList>
 *   {({ state }) =>
 *     matchList(state, {
 *       loading: () => <Spinner />,
 *       failed: (error) => <ErrorPanel error={error} />,
 *       empty: () => <NothingYet />,
 *       ready: (rows) => <List rows={rows} />,
 *     })
 *   }
 * </ConversationList>
 * ```
 */
export function ConversationList(props: {
  /**
   * WHO IS READING. The inbox stream key is `chat:user:<id>` and the server
   * derives it from the authenticated scope — the route carries no user
   * segment, so there is nothing to tamper with and nothing to infer. A
   * client that subscribed under a guessed id would open a socket that
   * delivers nothing, silently. So the id is asked for, and a list without
   * one polls and SAYS it is polling (`degraded.reason === "no_socket"`).
   *
   * The host knows who is signed in (`@stapel/auth-react`'s `useMe`); this
   * pair does not take a dependency on auth to find out.
   */
  viewerId?: string | number | null;
  limit?: number;
  /**
   * Narrow the list SERVER-SIDE (stapel-chat 0.8.2): a case-insensitive
   * substring over the three things a row draws — the counterpart's display
   * name, the subject card's title and the last line. Blank or whitespace-only
   * is no search at all.
   *
   * It is in the query key and it filters before the page is taken, so paging
   * a search walks the filtered list and `hasNextPage` means what it says.
   * The value is debounced by the query layer (`useSettledInboxFilter`) —
   * hand it the raw field value, not a pre-delayed one.
   */
  search?: string;
  /**
   * Keep only the conversations whose `unread_count` is above zero — the same
   * subquery the badge on each row is produced from, so a chip and a badge
   * cannot disagree. Applied immediately; only the search waits.
   */
  unreadOnly?: boolean;
  /**
   * WHICH OF THE TWO LISTS to read (stapel-chat 0.8.6). `"inbox"` (default)
   * is the conversations this person is in; `"left"` is its exact complement
   * — the ones they walked out of, newest departure first, each carrying its
   * own `left_at`.
   *
   * It is not a filter over the inbox and is not merged with it: the two are
   * ordered by different columns, so the left list gets its own cache entry
   * and its own anchor chain (`model/queryKeys.ts`), and a "load more" on one
   * can never page the other.
   *
   * `search` and `unreadOnly` compose here exactly as they do on the inbox.
   */
  view?: ChatInboxView;
  /** Debounce for `search`, in ms. Default 300; `0` sends every keystroke. */
  searchDebounceMs?: number;
  /** Poll period in ms; `0` turns the list's own freshness off entirely. */
  refreshIntervalMs?: number;
  children: (bag: ConversationListBag) => ReactNode;
}): ReactNode {
  const query = useConversations(props.limit, {
    ...(props.search !== undefined ? { search: props.search } : {}),
    ...(props.unreadOnly !== undefined ? { unreadOnly: props.unreadOnly } : {}),
    ...(props.view !== undefined ? { view: props.view } : {}),
    ...(props.searchDebounceMs !== undefined
      ? { searchDebounceMs: props.searchDebounceMs }
      : {}),
  });
  const mapKeys = useCallback(
    (_signal: ChatSignal) => [chatQueryKeys.conversations()],
    []
  );
  const viewerId =
    props.viewerId === null || props.viewerId === undefined
      ? null
      : String(props.viewerId);
  const freshness = useChatFreshness(
    viewerId === null ? null : chatInboxStream(viewerId),
    mapKeys,
    {
      fallbackRefetchInterval: props.refreshIntervalMs ?? CONVERSATION_LIST_INTERVAL_MS,
    }
  );

  // Pages are flattened INSIDE the ready arm — a failed or not-yet-run read
  // never produces a list at all.
  const state = mapLoad(loadStateFromQuery(query), (data) =>
    data.pages.flatMap((page) => page.items)
  );

  return props.children({
    state,
    unreadTotal: mapLoad(state, (rows) =>
      rows.reduce((total, row) => total + row.unread_count, 0)
    ),
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
    transport: freshness.transport,
    status: freshness.status,
    degraded: freshness.degraded,
    reconnect: freshness.reconnect,
  });
}
