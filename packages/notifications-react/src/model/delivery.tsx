/**
 * HOW THIS TAB LEARNS THAT A NOTIFICATION ARRIVED — and the rule that it must
 * always be able to say which way.
 *
 * A notification feed is the one surface where a stale read is the whole
 * failure. stapel-notifications 0.17.0 emits `notification.new` on the
 * recipient's own ephemeral stream (`notifications:user:<id>`, socket
 * `ws/notifications/inbox`), but serving that socket is an optional extra
 * (`pip install 'stapel-notifications[realtime]'`) — the module's product is a
 * delivered push plus a REST feed, and both are complete with no socket at
 * all. So this pair has to work well BOTH ways, and the two ways must not look
 * the same on screen.
 *
 *   live      a socket is connected; new rows arrive as frames
 *   connecting / reconnecting   the socket is coming (or coming back)
 *   refused   the socket will NOT come back on its own — a person is told
 *   polling   no socket in this deployment: the newest page is refetched
 *
 * `polling` is a MODE, not a fallback that happens quietly. The failure this
 * design exists to prevent is the one chat-react shipped for months: a socket
 * client that gave up after six attempts, fell back to a 15-second timer, and
 * said nothing — so nobody could tell a working product from a broken one.
 *
 * ── Why the socket adapter is a separate entry point ──────────────────────
 *
 * This module is imported by every skin and contains NO import of
 * `@stapel/realtime`: a host that polls must not carry a socket runtime it
 * will never open. The adapter that does import it is
 * `@stapel/notifications-react/live` (`<NotificationsLive userId={…}/>`), and
 * it publishes into the context below. Absent that provider the answer is
 * `polling`, which is exactly what a deployment without the extra should do.
 */
import { createContext, useContext, useSyncExternalStore } from "react";
import type { Context, ReactElement, ReactNode } from "react";

/** Which road new notifications are travelling to this tab. */
export type FeedDeliveryMode =
  | "live"
  | "connecting"
  | "reconnecting"
  | "refused"
  | "polling";

/** Why a socket will not come back on its own (mirrors `@stapel/realtime`'s
 * refusal kinds, restated here so this module imports nothing from it). */
export type FeedRefusalKind =
  | "session"
  | "origin"
  | "forbidden"
  | "stream_unknown"
  | "revoked";

export interface FeedDelivery {
  readonly mode: FeedDeliveryMode;
  /** Set when `mode === "refused"`; names WHICH refusal, so a skin can say
   * "sign in again" rather than "something went wrong". */
  readonly refusal?: FeedRefusalKind | undefined;
  /** The server's own sentence for the refusal, when it sent one. */
  readonly reason?: string | undefined;
  /** Retry now — the button beside a refusal. Absent when there is nothing to
   * retry (there is no socket in this deployment at all). */
  readonly reconnect?: (() => void) | undefined;
}

/**
 * How often the newest page is refetched with no socket: 60s while the tab is
 * visible, and never while it is hidden.
 *
 * The number is the backend's, not a guess (stapel-notifications MODULE.md
 * § "Live feed"): the push has already reached the device by another road, so
 * the socket-less feed is a catch-up view rather than the alerting path. A
 * tighter loop buys latency nobody is waiting on while multiplying an
 * authenticated read by every open tab.
 */
export const FEED_POLL_INTERVAL_MS = 60_000;

/** The floor the same document sets: never poll faster than this. */
export const FEED_POLL_MIN_INTERVAL_MS = 30_000;

const DELIVERY_WHEN_UNPROVIDED: FeedDelivery = { mode: "polling" };

export const FeedDeliveryContext: Context<FeedDelivery | null> =
  createContext<FeedDelivery | null>(null);

/**
 * The current delivery mode. `polling` when nothing published one — which is
 * the truth for a deployment that never installed the realtime extra, not a
 * degraded reading of a live one.
 */
export function useFeedDelivery(): FeedDelivery {
  return useContext(FeedDeliveryContext) ?? DELIVERY_WHEN_UNPROVIDED;
}

/** Publish a delivery mode to the skins below (used by `/live`; exported so a
 * host with its own transport can drive the same indicator). */
export function FeedDeliveryProvider(props: {
  value: FeedDelivery;
  children: ReactNode;
}): ReactElement {
  return (
    <FeedDeliveryContext.Provider value={props.value}>
      {props.children}
    </FeedDeliveryContext.Provider>
  );
}

// ── page visibility ─────────────────────────────────────────────────────────

function subscribeVisibility(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener("visibilitychange", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
  };
}

function readVisibility(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState !== "hidden";
}

/**
 * Is this tab visible? Read through `useSyncExternalStore`, so the polling
 * interval below stops the moment the tab is hidden rather than one render
 * later. SSR reports `false`: a document nobody is looking at is not polled.
 */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, readVisibility, () => false);
}

/**
 * The `refetchInterval` the feed query should run at, given the mode and the
 * tab's visibility. `false` means "do not poll": either a socket is carrying
 * the news, or nobody is looking.
 */
export function feedPollInterval(
  mode: FeedDeliveryMode,
  visible: boolean
): number | false {
  if (!visible) return false;
  // `connecting` polls too: the socket has not delivered anything yet, and a
  // feed that shows nothing while a handshake is in flight is the stale read
  // this whole file is about. `reconnecting` likewise.
  if (mode === "live") return false;
  return FEED_POLL_INTERVAL_MS;
}
