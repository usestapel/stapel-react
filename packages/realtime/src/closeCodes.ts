/**
 * The fleet's close-code table, mirrored from `stapel_realtime/close_codes.py`.
 *
 * One table for every module. Before the substrate, chat and video each minted
 * their own 4401/4403 and studio had a third set, so a client could not tell
 * "you were never allowed in" from "you just lost access" without knowing which
 * module it was talking to. All codes live in RFC 6455's private range
 * (4000–4999) and mirror the HTTP status they correspond to.
 *
 * What a client DOES with a code is the interesting half, and it is three
 * answers, not two — see {@link closeDisposition}.
 */

/** The client sent frames that are not v1 envelopes, repeatedly. */
export const CLOSE_PROTOCOL_ERROR = 4400;
/** No/invalid credential at handshake, or the token's `exp` passed mid-socket. */
export const CLOSE_UNAUTHENTICATED = 4401;
/** Authenticated, but `authorize()` said no for this stream. */
export const CLOSE_FORBIDDEN = 4403;
/** The URL did not resolve to a stream the consumer can serve. */
export const CLOSE_STREAM_UNKNOWN = 4404;
/** No `pong` inside the heartbeat window. */
export const CLOSE_HEARTBEAT_TIMEOUT = 4408;
/** Rights withdrawn while connected — a `kick` frame precedes this close. */
export const CLOSE_REVOKED = 4410;
/** The client could not keep up and the per-socket send queue overflowed. */
export const CLOSE_OVERFLOW = 4413;
/** The tenant's data home could not be resolved (L2+ isolation). */
export const CLOSE_DATA_HOME_UNAVAILABLE = 4503;

/** Abnormal closure — the browser's own code when a connection simply dies. */
export const CLOSE_ABNORMAL = 1006;
/** Service restart. A deploy, not a refusal. */
export const CLOSE_SERVICE_RESTART = 1012;

/** Code → short machine name, for logs and for a skin's status line. */
export const CLOSE_CODE_NAMES: Readonly<Record<number, string>> = {
  [CLOSE_PROTOCOL_ERROR]: "protocol_error",
  [CLOSE_UNAUTHENTICATED]: "unauthenticated",
  [CLOSE_FORBIDDEN]: "forbidden",
  [CLOSE_STREAM_UNKNOWN]: "stream_unknown",
  [CLOSE_HEARTBEAT_TIMEOUT]: "heartbeat_timeout",
  [CLOSE_REVOKED]: "revoked",
  [CLOSE_OVERFLOW]: "overflow",
  [CLOSE_DATA_HOME_UNAVAILABLE]: "data_home_unavailable",
};

/**
 * Closes a client must NOT retry with the same credentials — reconnecting
 * changes nothing until the user's access changes (`close_codes.py:70-72`).
 *
 * **4401 is deliberately absent.** For a cookie-authenticated browser it means
 * "your session needs refreshing", not "go away": treating it as terminal is
 * the single defect that put the whole product on polling. See
 * {@link closeDisposition}.
 */
export const TERMINAL_CLOSE_CODES: ReadonlySet<number> = new Set<number>([
  CLOSE_FORBIDDEN,
  CLOSE_STREAM_UNKNOWN,
  CLOSE_REVOKED,
]);

/** Machine name for a close code, or `"unknown"`. */
export function closeCodeName(code: number): string {
  return CLOSE_CODE_NAMES[code] ?? "unknown";
}

/**
 * What to do about a close code. Three answers, and collapsing any two of them
 * is a known production defect:
 *
 * - `"terminal"` — a refusal. The server answered the question; asking again,
 *   faster, is how a 4403 becomes an outage.
 * - `"reauthenticate"` — 4401. The credential, not the request, is stale. Hand
 *   it to the session seam (single-flight refresh), reconnect ONCE, and only
 *   then refuse. This is the HTTP-401 discipline, applied to a socket.
 * - `"reconnect"` — a fault. Back off with full jitter and try again, forever;
 *   a socket that silently gives up and lets the pair fall to polling is the
 *   failure this substrate exists to end.
 */
export type CloseDisposition = "terminal" | "reauthenticate" | "reconnect";

export function closeDisposition(code: number): CloseDisposition {
  if (code === CLOSE_UNAUTHENTICATED) return "reauthenticate";
  if (TERMINAL_CLOSE_CODES.has(code)) return "terminal";
  return "reconnect";
}
