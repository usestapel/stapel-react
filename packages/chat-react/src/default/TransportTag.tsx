/**
 * `<TransportTag/>` — the one place a person is told how freshness arrives,
 * and WHY it is not the socket when it is not.
 *
 * It is a label, never a behaviour: nothing on either chat screen branches on
 * it. That is the transport seam holding — the same components render a
 * socket-fed surface and a polled one.
 *
 * It lives in its own file because BOTH surfaces have a socket now: the thread
 * (`chat:conv:<id>`) always did, and the conversation list gained
 * `chat:user:<id>` when the cutover wired `ws/chat/inbox`. A list that polls
 * in silence is the same defect as a thread that polls in silence, one screen
 * over — so there is one tag, not two, and adding a degradation reason cannot
 * be done for one screen and forgotten on the other.
 */
import type { ReactElement } from "react";
import { Tag } from "antd";
import { useT } from "@stapel/core";
import type { RealtimeStreamStatus } from "@stapel/realtime";
import type { NoProviderStatus } from "@stapel/realtime/react";
import type { ChatDegraded, ChatDegradedReason } from "../realtime/degradation.js";
import type { ChatTransport } from "../flows/freshness.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/**
 * THE HEALTHY LABELS — and why "Refreshing every few seconds" is not one of
 * them any more.
 *
 * This map is read ONLY when `degraded` is `null`, which the seam guarantees
 * means nothing is wrong: the stream is live, or it is on its way, or it is
 * healing. `transport` is `"polling"` in all of the latter cases — the timer
 * genuinely is armed while the socket has not reported yet — and this map
 * used to answer that with the pair's own complaint copy. So a freshly
 * mounted, perfectly healthy thread printed "Refreshing every few seconds"
 * from its first frame until the socket opened, and a thread whose window was
 * still loading (`socketEnabled: loaded`, so the socket has not even been
 * attempted) printed it for as long as the read took. That is the exact
 * sentence the owner reported this product for, rendered when it was false.
 *
 * A standing banner is not a degradation notice; it is noise that teaches
 * people to skip the one message that matters. So the fallback now says the
 * true thing — the socket is connecting, or catching up — and every sentence
 * about polling belongs to a NAMED degradation, which is the only place the
 * seam can prove it.
 */
const HEALTHY_KEYS: Record<ChatTransport, string> = {
  socket: CHAT_I18N_KEYS.transportLive,
  polling: CHAT_I18N_KEYS.transportConnecting,
  idle: CHAT_I18N_KEYS.transportIdle,
};

/**
 * How loud each degradation is. antd's semantic presets, not colours: a
 * transient reconnect is neutral, something the person must act on is a
 * warning, and a refusal nothing here can undo is an error.
 *
 * `never_connected` is a warning rather than neutral on purpose. A socket that
 * has NEVER opened is not a spinner — it usually means the deployment is
 * misconfigured, and the person reading this is rarely the person who can fix
 * it, so it must be visible enough to be reported and not so loud that it
 * reads as their fault.
 *
 * `renewing_credential` is `processing` — the in-flight preset — and NOT a
 * warning, because it is a question and not yet anything to act on. If the
 * answer is one the person must act on, the tag becomes `sign_in_required`
 * and goes to `warning` on its own; colouring the question that loudly would
 * be the tag guessing which of the three outcomes is coming.
 */
const DEGRADED_TAG_COLORS: Record<ChatDegradedReason, string> = {
  reconnecting: "default",
  renewing_credential: "processing",
  no_socket: "default",
  reconnecting_long: "warning",
  never_connected: "warning",
  sign_in_required: "warning",
  forbidden: "error",
  revoked: "error",
  origin_not_allowed: "error",
  unsupported: "error",
};

export function TransportTag(props: {
  transport: ChatTransport;
  degraded: ChatDegraded | null;
  /**
   * The substrate's own stream state, when the caller has it. It separates
   * the two healthy non-live cases: a socket that has not opened yet
   * ("Connecting…") from one that is open and re-reading the journal after a
   * gap ("Catching up…"). Omit it and the honest generic is used.
   */
  status?: RealtimeStreamStatus | NoProviderStatus;
}): ReactElement | null {
  const t = useT();
  const { transport, degraded, status } = props;
  // A WORKING socket says nothing. The expected state needs no chrome, and a
  // permanent "Live" beside a person's name is read as a fact about THEM —
  // which is exactly how "Live" came to mean "the seller is online" to
  // every person who used this product. Presence has its own line now
  // (`PresenceLine`); this control speaks only about this client's transport,
  // and only when there is something to say.
  if (degraded === null && transport === "socket" && status?.state === "live") {
    return null;
  }
  // Healing is not degrading, and it is not connecting either: the socket is
  // open and the store is re-reading over REST.
  const healthyKey =
    transport === "polling" && status?.state === "resync"
      ? CHAT_I18N_KEYS.transportCatchingUp
      : HEALTHY_KEYS[transport];
  return (
    <Tag
      data-testid="chat-transport"
      data-transport={transport}
      // antd's Tag is `white-space: nowrap` by default; a degradation is a
      // sentence, not a word, so it is allowed to take two lines instead of
      // one very long one. `marginInlineEnd: 0` because the Flex gap that
      // holds it owns the spacing.
      style={{ whiteSpace: "normal", marginInlineEnd: 0 }}
      {...(degraded
        ? {
            "data-degraded": degraded.reason,
            color: DEGRADED_TAG_COLORS[degraded.reason],
          }
        : {})}
    >
      {degraded ? t(degraded.messageKey) : t(healthyKey)}
    </Tag>
  );
}
