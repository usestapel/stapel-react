import { useCallback } from "react";
import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { Conversation } from "../api/types.js";
import { useConversations } from "../model/queries.js";
import { chatQueryKeys } from "../model/queryKeys.js";
import {
  CONVERSATION_LIST_INTERVAL_MS,
  useChatFreshness,
} from "../flows/freshness.js";
import type { ChatSignal, ChatTransport } from "../flows/freshness.js";
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
   */
  readonly unreadTotal: LoadState<number>;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  fetchNextPage(): void;
  refetch(): void;
  /** Which transport is keeping this list fresh (always polling — the module
   * mounts no socket for the inbox; see `realtime/streams.ts`). */
  readonly transport: ChatTransport;
}

/**
 * Headless conversation list — a renderless load-more list over
 * `GET /chat/api/v1/conversations`, kept fresh through the transport seam.
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
  limit?: number;
  /** Poll period in ms; `0` turns the list's own freshness off entirely. */
  refreshIntervalMs?: number;
  children: (bag: ConversationListBag) => ReactNode;
}): ReactNode {
  const query = useConversations(props.limit);
  const mapKeys = useCallback(
    (_signal: ChatSignal) => [chatQueryKeys.conversations()],
    []
  );
  const freshness = useChatFreshness(chatInboxStream(), mapKeys, {
    fallbackRefetchInterval: props.refreshIntervalMs ?? CONVERSATION_LIST_INTERVAL_MS,
  });

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
  });
}
