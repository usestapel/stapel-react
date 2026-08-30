/**
 * WHO IS ACTUALLY THERE — and never "is my own socket up".
 *
 * ── The defect ────────────────────────────────────────────────────────────
 *
 * The thread header used to draw "connected" whenever THIS
 * browser's websocket was open. In a marketplace it sat beside the seller's
 * name and it read as "the seller is online". It was never that: it was the
 * reader's own network, wearing somebody else's name. Two people in a dead
 * thread were each told the other was there.
 *
 * ── The rule this module exists to enforce ────────────────────────────────
 *
 * Presence comes from the SERVER, about the OTHER participant, from their own
 * connections (stapel-chat 0.7.0 `presence.py`). It arrives two ways and the
 * two agree by construction, because they are the same two fields:
 *
 *  - on every conversation body, as `participants[].online` /
 *    `.last_seen_at`, so a header paints correctly on first load;
 *  - as `chat.presence.changed` on the conversation stream, so it stays
 *    correct without a poll.
 *
 * The live frame is applied straight into the cached conversation rather than
 * invalidating it. A flip carries everything the header needs, so a refetch
 * would buy nothing — and with several peers going online at once, an
 * invalidation per flip is a refetch storm for a line of text.
 *
 * This module reads no transport state and takes no socket as an argument.
 * That is not an omission; it is the fix. A client's own connection health is
 * a real thing to show, and `TransportTag` shows it, about itself.
 *
 * ── Why `online` has an expiry, and why that is not a poll ────────────────
 *
 * `chat.presence.changed` is announced from a DISCONNECT. A lease running out
 * announces nothing, because nothing happens — no socket closes, no row is
 * written, there is no event for the server to send. And the lease exists
 * precisely for the case where no disconnect ever runs: a killed tab, a lost
 * worker. So exactly when the peer vanishes most abruptly, a client told only
 * `online: true` hears nothing more and believes it forever. That was
 * observed live: a header said online ninety seconds after the peer was gone,
 * while the server had already said offline.
 *
 * `online_until` (stapel-chat 0.7.3) is the deadline the SERVER evaluates,
 * handed over so the client reaches the same answer on its own clock. It
 * makes an `online` self-limiting rather than making the client ask again —
 * one timer per rendered participant, no interval, no traffic. A body without
 * the field (an older server) keeps the previous behaviour exactly.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { Conversation, Participant } from "../api/types.js";
import type { ChatPresencePayload } from "../realtime/frames.js";
import { chatQueryKeys } from "./queryKeys.js";

/** One participant's presence, as a header renders it. */
export interface ChatPresence {
  /** Connected right now — their sockets, not yours. */
  readonly online: boolean;
  /**
   * When they were last connected or active, ISO 8601. `null` means this
   * deployment has never seen them connect — say nothing, do not guess.
   */
  readonly lastSeenAt: string | null;
  /**
   * When `online` stops being believable, ISO 8601, or `null` when the server
   * did not say. A reader must stop treating `online` as true at this
   * instant, exactly as the server does.
   */
  readonly onlineUntil: string | null;
}

/** What a participant with no presence on the wire reads as. */
export const PRESENCE_UNKNOWN: ChatPresence = {
  online: false,
  lastSeenAt: null,
  onlineUntil: null,
};

/**
 * Has the server's own deadline passed?
 *
 * `null` — an older server that sends no deadline — is NOT expired: the
 * previous behaviour is kept rather than every such participant being blinked
 * offline by a field their server has never heard of. An unparseable value is
 * treated the same way, for the same reason.
 */
export function presenceExpired(
  presence: ChatPresence,
  now: number = Date.now()
): boolean {
  if (!presence.online || presence.onlineUntil === null) return false;
  const deadline = Date.parse(presence.onlineUntil);
  return Number.isFinite(deadline) && deadline <= now;
}

/**
 * The presence as it should be RENDERED at `now` — `online` forced false once
 * the deadline has passed, with `lastSeenAt` left exactly as the server sent
 * it, because that is still the last time anybody saw them.
 */
export function presenceAt(
  presence: ChatPresence,
  now: number = Date.now()
): ChatPresence {
  return presenceExpired(presence, now) ? { ...presence, online: false } : presence;
}

/**
 * Milliseconds until this presence needs re-rendering, or `null` when it
 * never does. Only a LIVE claim with a future deadline has anything to wait
 * for: an offline participant is already at its final answer, and one with no
 * deadline has nothing to wait on. This is what keeps the mechanism a single
 * timer per participant instead of an interval.
 */
export function presenceExpiryDelay(
  presence: ChatPresence,
  now: number = Date.now()
): number | null {
  if (!presence.online || presence.onlineUntil === null) return null;
  const deadline = Date.parse(presence.onlineUntil);
  if (!Number.isFinite(deadline)) return null;
  return deadline > now ? deadline - now : 0;
}

/**
 * Read one participant's presence off a conversation body.
 *
 * A server too old to send the fields answers `undefined` for both, which
 * lands on {@link PRESENCE_UNKNOWN} — offline with nothing to say — rather
 * than on a fabricated "online". Degrading toward silence is the only safe
 * direction here: a false "online" is the bug.
 */
export function participantPresence(
  conversation: Conversation | undefined,
  userId: string | null
): ChatPresence {
  if (conversation === undefined || userId === null) return PRESENCE_UNKNOWN;
  // `participants` is optional in the generated schema; a body without it is
  // a body with nobody to be present, not a crash.
  const participant = (conversation.participants ?? []).find(
    (candidate: Participant) => candidate.user_id === userId
  );
  if (participant === undefined) return PRESENCE_UNKNOWN;
  return {
    online: participant.online === true,
    lastSeenAt: participant.last_seen_at ?? null,
    onlineUntil: participant.online_until ?? null,
  };
}

/**
 * Apply a live `chat.presence.changed` to the cached conversation.
 *
 * A no-op when the conversation is not cached (nothing is rendering it) or
 * when the participant is not on it (a frame for a thread this client does
 * not hold). Returns whether anything changed, which is what the tests assert
 * instead of reaching into the cache themselves.
 */
export function applyConversationPresence(
  queryClient: QueryClient,
  presence: ChatPresencePayload
): boolean {
  const key = chatQueryKeys.conversation(presence.conversation_id);
  const cached = queryClient.getQueryData<Conversation>(key);
  if (cached === undefined) return false;
  let touched = false;
  const participants = (cached.participants ?? []).map((participant: Participant) => {
    if (participant.user_id !== presence.user_id) return participant;
    if (
      participant.online === presence.online &&
      (participant.last_seen_at ?? null) === presence.last_seen_at &&
      (participant.online_until ?? null) === presence.online_until
    ) {
      return participant;
    }
    touched = true;
    return {
      ...participant,
      online: presence.online,
      last_seen_at: presence.last_seen_at,
      online_until: presence.online_until,
    };
  });
  if (!touched) return false;
  queryClient.setQueryData<Conversation>(key, { ...cached, participants });
  return true;
}
