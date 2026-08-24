/**
 * `@stapel/notifications-react/live` — the socket half, behind its own entry
 * point.
 *
 * ```tsx
 * import { RealtimeProvider } from "@stapel/realtime/react";
 * import { NotificationsLive } from "@stapel/notifications-react/live";
 *
 * <RealtimeProvider url={() => `${wsOrigin}/ws/notifications/inbox`}>
 *   <NotificationsLive userId={me.id}>{app}</NotificationsLive>
 * </RealtimeProvider>
 * ```
 *
 * ── Why this is a separate subpath ────────────────────────────────────────
 *
 * Serving the stream is an OPTIONAL extra on the backend
 * (`pip install 'stapel-notifications[realtime]'`), and the module's product —
 * a delivered push plus a REST feed — is complete without it. So `@stapel/
 * realtime` is an optional peer here and this is the only file that imports
 * it: a deployment that polls never carries a socket runtime it will not open,
 * exactly as `/default` keeps antd out of a host that brings its own visuals.
 *
 * ── This pair does not open a socket ──────────────────────────────────────
 *
 * Everything socket-shaped is `@stapel/realtime`'s: reconnect, resume, the
 * close-code table, the 4401 session refresh. `chat-react/src/realtime/
 * chatSocket.ts` is the counter-example the substrate exists to retire, and
 * the fleet lint (`stapel/no-adhoc-socket`) makes writing a second one an
 * error. What this file owns is the two module-specific facts: the stream key
 * and what a `notification.new` payload means.
 *
 * ── Ephemeral, and what follows from that ─────────────────────────────────
 *
 * The stream is ephemeral: no `seq`, no journal, no replay. Signals guarantee
 * delivery only to sockets connected at emit time, so a frame that arrives is
 * a bonus, never the record — the REST feed remains the source of truth and a
 * reconnect re-reads it rather than replaying. That is why the arriving row is
 * merged into the cache by `id` and never used to advance a cursor.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { useStream } from "@stapel/realtime/react";
import type { RealtimeFrame, RealtimeStreamStatus } from "@stapel/realtime";
import type { FeedItem, NotificationFeedPage } from "../api/types.js";
import { notificationsQueryKeys } from "../model/queryKeys.js";
import { FeedDeliveryProvider } from "../model/delivery.js";
import type { FeedDelivery, FeedDeliveryMode } from "../model/delivery.js";

/** The signal a `sent` push delivery emits (stapel-notifications 0.17.0). */
export const NOTIFICATION_NEW_SIGNAL = "notification.new";

/** The read-only socket route the module mounts. No user segment: the stream
 * key comes from the authenticated scope, server-side. */
export const NOTIFICATIONS_INBOX_PATH = "ws/notifications/inbox";

/**
 * The recipient's own stream key, `notifications:user:<user_id>`.
 *
 * The server stamps this on every frame's envelope and the client routes on
 * it, so it has to be the same string on both sides — which is why the id is a
 * required argument rather than something this pair tries to infer. The host
 * knows who is signed in (`@stapel/auth-react`'s `useMe`); this pair does not
 * take a dependency on auth to find out.
 */
export function notificationsInboxStream(userId: string | number): string {
  return `notifications:user:${String(userId)}`;
}

/**
 * `RealtimeStreamStatus` → the mode a skin renders.
 *
 * `replaying` cannot occur on an ephemeral stream and is mapped with the rest
 * for completeness. The one deliberate re-reading is `refusal: "unsupported"`
 * — the substrate's word for "this environment has no `WebSocket`" (SSR, a
 * node runner). That is not a refusal a person can act on and there is nothing
 * to reconnect to: what actually happens is that the feed is polled, so that
 * is what the indicator says.
 */
function toDeliveryMode(status: RealtimeStreamStatus): FeedDeliveryMode {
  if (status.refusal === "unsupported") return "polling";
  switch (status.state) {
    case "live":
    case "replaying":
      return "live";
    case "connecting":
    case "idle":
      return "connecting";
    case "reconnecting":
    case "resync":
      return "reconnecting";
    case "refused":
      return "refused";
    case "closed":
      return "polling";
  }
}

/**
 * A `FeedItemResponse` off the wire, or `undefined` when the payload is not
 * one. The socket carries the feed row field-for-field, so this is a shape
 * check and not a translation — but it is still a check: an untyped
 * `Record<string, unknown>` reaching a list renderer is how a socket turns a
 * server bug into a blank screen.
 */
function readFeedItem(payload: Readonly<Record<string, unknown>>): FeedItem | undefined {
  const { id, notification_type, title, body, created_at, data } = payload;
  if (
    typeof id !== "string" ||
    typeof notification_type !== "string" ||
    typeof title !== "string" ||
    typeof body !== "string" ||
    typeof created_at !== "string" ||
    typeof data !== "object" ||
    data === null
  ) {
    return undefined;
  }
  return {
    id,
    notification_type,
    title,
    body,
    created_at,
    data: data as FeedItem["data"],
  };
}

type FeedCache = InfiniteData<NotificationFeedPage, string | undefined>;

/**
 * Put an arriving row at the top of the newest page.
 *
 * Upsert by `id`, never by position: the same delivery can reach a tab twice
 * (a socket frame and a poll that raced it), and a list that appended blindly
 * would show it twice. A cache that has not been read yet is left alone — the
 * first `GET /feed/` will carry the row anyway, and seeding a page from a
 * signal would invent `has_next: false` for a feed nobody has paged.
 */
export function mergeArrivedItem(cache: FeedCache | undefined, item: FeedItem): FeedCache | undefined {
  if (cache === undefined || cache.pages.length === 0) return cache;
  const already = cache.pages.some((page) =>
    page.items.some((existing) => existing.id === item.id)
  );
  if (already) return cache;
  const [newest, ...rest] = cache.pages as [NotificationFeedPage, ...NotificationFeedPage[]];
  return {
    ...cache,
    pages: [
      { ...newest, items: [item, ...newest.items], count: newest.count + 1 },
      ...rest,
    ],
  };
}

export interface NotificationsLiveProps {
  /** The signed-in user's id — the `<user_id>` half of the stream key. */
  readonly userId: string | number;
  /** Override the provider's URL resolution for this one stream. */
  readonly url?: string;
  /** `false` unsubscribes without unmounting; the mode falls back to
   * `polling`, which is what a closed socket honestly is. */
  readonly enabled?: boolean;
  /** Called for every arriving row, after the cache merge — a host's hook for
   * a toast or a title-bar count. */
  readonly onNotification?: (item: FeedItem) => void;
  readonly children?: ReactNode;
}

/**
 * Subscribes to the recipient's inbox stream and publishes the delivery mode
 * to every notifications skin below it. Renders nothing of its own.
 */
export function NotificationsLive(props: NotificationsLiveProps): ReactElement {
  const { userId, url, enabled = true, onNotification, children } = props;
  const queryClient: QueryClient = useQueryClient();
  const stream = notificationsInboxStream(userId);

  const notify = useRef(onNotification);
  notify.current = onNotification;

  const onFrame = useCallback(
    (frame: RealtimeFrame): void => {
      if (frame.type !== NOTIFICATION_NEW_SIGNAL) return;
      const item = readFeedItem(frame.payload);
      if (item === undefined) return;
      queryClient.setQueryData<FeedCache>(notificationsQueryKeys.feed(), (cache) =>
        mergeArrivedItem(cache, item)
      );
      notify.current?.(item);
    },
    [queryClient]
  );

  const { status, reconnect } = useStream(stream, {
    ...(url !== undefined ? { url } : {}),
    enabled,
    onFrame,
  });

  // A socket that comes (back) up may have missed frames while it was down —
  // the stream is ephemeral, so there is nothing to replay. The honest repair
  // is one REST read, which is also what a first connect wants.
  const live = status.state === "live";
  useEffect(() => {
    if (!live) return;
    void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.feed() });
  }, [live, queryClient]);

  const delivery = useMemo<FeedDelivery>(
    () => ({
      mode: enabled ? toDeliveryMode(status) : "polling",
      refusal: status.refusal === "unsupported" ? undefined : status.refusal,
      reason: status.reason,
      reconnect,
    }),
    [enabled, status, reconnect]
  );

  return <FeedDeliveryProvider value={delivery}>{children}</FeedDeliveryProvider>;
}
