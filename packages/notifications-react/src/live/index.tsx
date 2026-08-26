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
import type { QueryClient } from "@tanstack/react-query";
import { useStream } from "@stapel/realtime/react";
import type { RealtimeFrame, RealtimeStreamStatus } from "@stapel/realtime";
import type { FeedItem } from "../api/types.js";
import { notificationsQueryKeys } from "../model/queryKeys.js";
import { applyReadSignal, mergeArrivedItem } from "../model/feedCache.js";
import type { FeedCache, FeedReadSignal } from "../model/feedCache.js";
import { FeedDeliveryProvider } from "../model/delivery.js";
import type { FeedDelivery, FeedDeliveryMode } from "../model/delivery.js";

/**
 * The cache transforms this adapter applies. They live in `model/feedCache.ts`,
 * outside this entry point, because `model/mutations.ts` needs the identical
 * write for its optimistic stamp and must not import `@stapel/realtime` to get
 * it. Re-exported here so this subpath's published surface is unchanged.
 */
export { mergeArrivedItem, applyReadSignal } from "../model/feedCache.js";
export type { FeedCache, FeedReadSignal } from "../model/feedCache.js";

/** The signal a `sent` push delivery emits (stapel-notifications 0.17.0). */
export const NOTIFICATION_NEW_SIGNAL = "notification.new";

/**
 * The signal `POST feed/read/` emits when it actually changed something
 * (stapel-notifications 0.18.0).
 *
 * "When it actually changed something" is load-bearing: a repeat that marks
 * nothing emits nothing, because a no-op frame is how two open tabs start
 * correcting each other in a loop.
 */
export const NOTIFICATION_READ_SIGNAL = "notification.read";

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
  const { id, notification_type, title, body, created_at, data, read_at } = payload;
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
    // `notification.new` carries `FeedItemResponse` field-for-field, `read_at`
    // included — and for a row that has just been delivered it is null. Read
    // rather than assumed: a null that arrived is the same value as a null we
    // would have invented, and a non-null one (a redelivery of something
    // already seen) would otherwise be drawn bold.
    read_at: typeof read_at === "string" ? read_at : null,
    data: data as FeedItem["data"],
  };
}

/**
 * A `notification.read` payload off the wire, or `undefined` when it is not
 * one.
 *
 * `unread_count` is required and `all`/`ids` are read defensively, because the
 * badge is the one number a bad frame could pin at a wrong value until the
 * next page read. `ids` is filtered to strings rather than rejected wholesale:
 * a frame naming ten rows of which one is malformed should still clear nine.
 */
function readReadSignal(
  payload: Readonly<Record<string, unknown>>
): FeedReadSignal | undefined {
  const { ids, all, unread_count } = payload;
  if (typeof unread_count !== "number" || !Number.isFinite(unread_count)) {
    return undefined;
  }
  return {
    ids: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [],
    all: all === true,
    unread_count,
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
      if (frame.type === NOTIFICATION_NEW_SIGNAL) {
        const item = readFeedItem(frame.payload);
        if (item === undefined) return;
        queryClient.setQueryData<FeedCache>(notificationsQueryKeys.feed(), (cache) =>
          mergeArrivedItem(cache, item)
        );
        notify.current?.(item);
        return;
      }
      if (frame.type === NOTIFICATION_READ_SIGNAL) {
        // Somebody cleared rows — this tab, or another screen of the same
        // account. Applied to the cache instead of invalidating: the frame
        // carries both halves (which rows, and the badge value that is now
        // true), so a refetch would buy nothing and would race the optimistic
        // write that a mark FROM THIS TAB has already applied.
        const signal = readReadSignal(frame.payload);
        if (signal === undefined) return;
        queryClient.setQueryData<FeedCache>(notificationsQueryKeys.feed(), (cache) =>
          applyReadSignal(cache, signal, new Date().toISOString())
        );
      }
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
