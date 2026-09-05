/**
 * The ring's realtime half, as data.
 *
 * stapel-video 0.11.0 mounts `ws/video/inbox` (`routing.py`) and relays four
 * frame types on `video:user:<user_id>`: `call.incoming`, `call.accepted`,
 * `call.declined`, `call.ended`.
 *
 * ── The socket path carries NO id, and that is the authorization ──────────
 *
 * The lobby's path carries a join code (`ws/video/lobby/<code>`) because a
 * lobby is a shared fact about a room. A ring is addressed to exactly one
 * person, and its stream key is built on the server FROM THE AUTHENTICATED
 * SCOPE — so the consumer physically cannot name somebody else's inbox. A path
 * parameter would turn that into a comparison somebody has to remember to
 * write, and forgetting it hands one person another's ring.
 *
 * {@link callInboxStreamKey} therefore takes a user id only to name the stream
 * a CLIENT subscribes under; the server never reads it off the URL.
 *
 * ── No credential travels here ────────────────────────────────────────────
 *
 * `lobby.admitted` carries a media token and the lobby consumer has to redact
 * it for every socket the frame does not name. Nothing in this file carries
 * one: the callee's token comes back from `POST /calls/{id}/accept`, an
 * authenticated request by the person it belongs to. A rule nobody has to obey
 * is a rule nobody can break, and it is why the incoming-call overlay can be
 * rendered from a frame without thinking about who else is watching.
 *
 * ── Best-effort, and the repair that makes that safe ──────────────────────
 *
 * These are Signals: no transport, no subscriber, a dropped redis — the frame
 * is gone and nothing raises. The durable fact is the `Call` row, and
 * `GET /calls/active` is the read that recovers from either loss (a ring that
 * never arrived, or an end that never did). That read on mount and on every
 * reconnect is what turns "the socket is unreliable" from a defect into a
 * property, and it is a requirement of the provider rather than a nicety.
 *
 * The frame parameter is STRUCTURAL (`CallFrameLike`) for the same reason
 * `model/lobby.ts`'s is: the headless entry keeps no dependency on the socket
 * package, so a host on its own transport can feed these decoders.
 */
import type { CallResponse } from "../api/types.js";

/** Somebody is calling you. To the callee. */
export const CALL_FRAME_INCOMING = "call.incoming";
/** They picked up. To the caller. */
export const CALL_FRAME_ACCEPTED = "call.accepted";
/** They refused. To the caller. */
export const CALL_FRAME_DECLINED = "call.declined";
/** It is over, however it ended. To BOTH parties — a ringing overlay has to
 * close on the callee's screen too when the caller gives up. */
export const CALL_FRAME_ENDED = "call.ended";

/** The four, as one list — the set a test asserts against the backend's. */
export const CALL_FRAME_TYPES: readonly string[] = [
  CALL_FRAME_INCOMING,
  CALL_FRAME_ACCEPTED,
  CALL_FRAME_DECLINED,
  CALL_FRAME_ENDED,
];

/** The shape this module needs off a decoded realtime frame. */
export interface CallFrameLike {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Somebody is ringing you. Carries no token — see the module note. */
export interface IncomingCallEvent {
  readonly kind: "incoming";
  readonly callId: string;
  readonly callerId: string;
  /** The conversation the call hangs off. `""` is possible on the wire and
   * means the deployment allows callee-id calls; the host decides what to
   * show for it. */
  readonly threadKey: string;
  /** `audio` or `video`, as the caller asked. */
  readonly media: string;
  readonly startedAt: string | undefined;
  /** The SERVER's ring deadline. The overlay counts down against this. */
  readonly expiresAt: string | undefined;
}

/** They picked up. */
export interface CallAcceptedEvent {
  readonly kind: "accepted";
  readonly callId: string;
  readonly answeredAt: string | undefined;
}

/** They refused. */
export interface CallDeclinedEvent {
  readonly kind: "declined";
  readonly callId: string;
}

/** It is over. `state` says how (`ended` / `missed` / `declined` / `failed`)
 * and `durationSeconds` is the server's own number. */
export interface CallEndedEvent {
  readonly kind: "ended";
  readonly callId: string;
  readonly state: string;
  readonly endReason: string;
  readonly durationSeconds: number;
}

export type CallInboxEvent =
  | IncomingCallEvent
  | CallAcceptedEvent
  | CallDeclinedEvent
  | CallEndedEvent;

/** `video:user:<user_id>` — one person's ephemeral call inbox. */
export function callInboxStreamKey(userId: string): string {
  return `video:user:${userId}`;
}

/**
 * The socket path. No id in it, deliberately — see the module note.
 *
 * Exported as a constant rather than a function precisely so that adding one
 * is a visible change to a value the whole package shares, and not a quiet
 * extra argument at one call site.
 */
export const CALL_INBOX_SOCKET_PATH = "/ws/video/inbox";

/** The absolute URL for a socket origin (`wss://api.example.com`). */
export function callInboxSocketUrl(wsOrigin: string): string {
  return `${wsOrigin.replace(/\/+$/u, "")}${CALL_INBOX_SOCKET_PATH}`;
}

/**
 * One frame → one event, or `undefined` for anything this pair does not
 * speak.
 *
 * `undefined` and not a thrown error: the stream is the module's, but a
 * deployment may relay frames this version has never heard of, and a client
 * that threw on an unknown type would turn a forward-compatible addition into
 * a broken screen.
 */
export function decodeCallEvent(frame: CallFrameLike): CallInboxEvent | undefined {
  const payload = frame.payload;
  const callId = str(payload["call_id"]);
  if (callId === undefined) return undefined;
  switch (frame.type) {
    case CALL_FRAME_INCOMING: {
      const callerId = str(payload["caller_id"]);
      if (callerId === undefined) return undefined;
      return {
        kind: "incoming",
        callId,
        callerId,
        threadKey: str(payload["thread_key"]) ?? "",
        media: str(payload["media"]) ?? "video",
        startedAt: str(payload["started_at"]),
        expiresAt: str(payload["expires_at"]),
      };
    }
    case CALL_FRAME_ACCEPTED:
      return { kind: "accepted", callId, answeredAt: str(payload["answered_at"]) };
    case CALL_FRAME_DECLINED:
      return { kind: "declined", callId };
    case CALL_FRAME_ENDED:
      return {
        kind: "ended",
        callId,
        state: str(payload["state"]) ?? "ended",
        endReason: str(payload["end_reason"]) ?? "",
        durationSeconds: num(payload["duration_seconds"]) ?? 0,
      };
    default:
      return undefined;
  }
}

/**
 * Apply an event to the call this screen is holding.
 *
 * Returns the call as it now stands, or `null` when the event ends it. The
 * ONE place a frame is allowed to change local state, so the rule that a frame
 * about a DIFFERENT call is ignored lives once: an `ended` for a call this
 * screen is not showing must not close the one it is.
 *
 * Note what this cannot do: build a `CallResponse` out of an `incoming` frame.
 * The frame carries five fields and the row carries thirteen, and inventing
 * the rest would put a fabricated `state` on screen. The provider fetches the
 * call instead — which is also how it recovers from a frame it never got.
 */
export function applyCallEvent(
  current: CallResponse | null,
  event: CallInboxEvent
): CallResponse | null {
  if (current === null) return null;
  if (String(current.id) !== String(event.callId)) return current;
  switch (event.kind) {
    case "accepted":
      return {
        ...current,
        state: "accepted",
        ...(event.answeredAt !== undefined ? { answered_at: event.answeredAt } : {}),
      };
    case "declined":
    case "ended":
      return null;
    case "incoming":
      return current;
    default:
      return current;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
