/**
 * THE ONE PLACE A CLOSE CODE IS INTERPRETED.
 *
 * Before this file the client branched on close codes inline, at the call
 * site, with two constants and one rule: "4401 or 4403 → never come back".
 * That rule is what turned a credential-channel mismatch into a product that
 * refreshed every few seconds for months. A browser cannot set an
 * `Authorization` header on `new WebSocket()`; every browser handshake closed
 * 4401; the client read 4401 as a permanent refusal and quietly handed the
 * stream to its polling half.
 *
 * The correction is not "retry 4401 too" — hammering a host with a question
 * it already declined is the other half of the same mistake. It is that
 * **4401 is a statement about the CREDENTIAL, not about the socket**: the
 * access token expired, or never travelled on a channel the handshake reads.
 * A credential can be renewed; a refusal to a renewed credential is a
 * different fact, and only the second one is terminal.
 *
 * So there are three actions, not two, and every close code maps to exactly
 * one of them here — never at a call site.
 *
 * The codes are `stapel_realtime.close_codes` verbatim (chat's `MODULE.md`
 * §"The wire contract" restates them). This table is a MIRROR of that module,
 * so a code added there is added here and nowhere else.
 */

// ── the substrate's canon (stapel_realtime/close_codes.py) ───────────────────

/** The client sent something that is not a v1 envelope, repeatedly. */
export const CHAT_WS_CLOSE_PROTOCOL_ERROR = 4400;
/**
 * No, invalid or expired credential at the handshake — raised by core's G14
 * middleware BEFORE accept, or when `exp` passes on an open socket.
 */
export const CHAT_WS_CLOSE_UNAUTHENTICATED = 4401;
/**
 * Authenticated, but this handshake is not allowed: `authorize()` said no for
 * this stream, OR (cookie channel only) the page's `Origin` is not on the
 * deployment's allowlist. Both are answers about rights, not credentials.
 */
export const CHAT_WS_CLOSE_FORBIDDEN = 4403;
/** The URL resolved to a stream key the consumer cannot serve. */
export const CHAT_WS_CLOSE_STREAM_UNKNOWN = 4404;
/** No `pong` within the heartbeat window. */
export const CHAT_WS_CLOSE_HEARTBEAT_TIMEOUT = 4408;
/** Rights withdrawn while connected (`revoke()`), after a `kick` frame. */
export const CHAT_WS_CLOSE_REVOKED = 4410;
/** The client could not keep up and the per-socket send queue overflowed. */
export const CHAT_WS_CLOSE_OVERFLOW = 4413;
/** The tenant's data home could not be resolved — infrastructure, transient. */
export const CHAT_WS_CLOSE_DATA_HOME_UNAVAILABLE = 4503;

/**
 * @deprecated Use {@link CHAT_WS_CLOSE_FORBIDDEN}. 4403 is not only "not a
 * participant" — a cookie handshake from an unlisted origin closes with it
 * too, and a client that renders "you are not a participant" over a
 * deployment's origin misconfiguration is lying to the person reading it.
 */
export const CHAT_WS_CLOSE_NOT_PARTICIPANT: 4403 = CHAT_WS_CLOSE_FORBIDDEN;

// ── the verdict ──────────────────────────────────────────────────────────────

/**
 * What the client does next.
 *
 *  - `reconnect` — a fault. Back off, jitter, try again with the same
 *    credential.
 *  - `renew-credential` — the credential was refused. Ask the host to renew
 *    it (core's session/`onAuthRefresh` seam) and reconnect ONLY if it
 *    actually renewed. Without a renewal seam, or after one that failed,
 *    this becomes `stop` with `unauthenticated` — surfaced, never silent.
 *  - `stop` — the host answered a question about rights or about this build.
 *    Asking again, faster, changes nothing.
 */
export type ChatCloseAction = "reconnect" | "renew-credential" | "stop";

/**
 * Why the socket is not carrying the stream, in one stable machine name.
 * Every one of these reaches the UI: a degraded transport that cannot say
 * why is the defect this module was rewritten for.
 */
export type ChatCloseReason =
  | "transport"
  | "heartbeat"
  | "overflow"
  | "infrastructure"
  | "protocol"
  | "credential_rejected"
  | "forbidden"
  | "unknown_stream"
  | "revoked";

export interface ChatClosePolicy {
  readonly action: ChatCloseAction;
  readonly reason: ChatCloseReason;
}

const POLICIES: Readonly<Record<number, ChatClosePolicy>> = {
  // A refused credential is renewable — that is the whole point of the three
  // actions. It becomes terminal only after a renewal was impossible or was
  // itself refused.
  [CHAT_WS_CLOSE_UNAUTHENTICATED]: {
    action: "renew-credential",
    reason: "credential_rejected",
  },
  // Rights, not credentials: a new token answers the same question the same
  // way. (`stapel_realtime.TERMINAL_CLOSE_CODES` is exactly these three.)
  [CHAT_WS_CLOSE_FORBIDDEN]: { action: "stop", reason: "forbidden" },
  [CHAT_WS_CLOSE_STREAM_UNKNOWN]: { action: "stop", reason: "unknown_stream" },
  [CHAT_WS_CLOSE_REVOKED]: { action: "stop", reason: "revoked" },
  // This build keeps sending frames the server cannot read. Reconnecting runs
  // the same code and gets the same answer.
  [CHAT_WS_CLOSE_PROTOCOL_ERROR]: { action: "stop", reason: "protocol" },
  // Faults. Everything here is "try again in a moment".
  [CHAT_WS_CLOSE_HEARTBEAT_TIMEOUT]: { action: "reconnect", reason: "heartbeat" },
  [CHAT_WS_CLOSE_OVERFLOW]: { action: "reconnect", reason: "overflow" },
  [CHAT_WS_CLOSE_DATA_HOME_UNAVAILABLE]: {
    action: "reconnect",
    reason: "infrastructure",
  },
};

const TRANSPORT_FAULT: ChatClosePolicy = {
  action: "reconnect",
  reason: "transport",
};

/**
 * The verdict for one close code. Unknown codes — 1006 (abnormal), 1001
 * (the proxy cycled), anything a future substrate mints — are FAULTS, which
 * is the safe default: a client that stops on a code it does not recognise
 * is a client that stops.
 */
export function chatClosePolicy(code: number): ChatClosePolicy {
  return POLICIES[code] ?? TRANSPORT_FAULT;
}
