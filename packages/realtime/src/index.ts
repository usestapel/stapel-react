/**
 * `@stapel/realtime` — the client half of the `stapel-realtime` substrate.
 *
 * One reconnect/resume runtime for the whole fleet, so chat, notifications,
 * tasks, moderation and the video lobby stop each writing their own socket
 * with their own close-code table (which is how a 4403 in one module and a
 * 4403 in another came to mean different things).
 *
 * This entry is framework-free: no React, no design system, no query layer.
 * `@stapel/realtime/react` adds the provider and the two hooks.
 *
 * The four things a consumer must get right, and where they live here:
 *
 * | Rule | Here |
 * |---|---|
 * | resume cursor ≠ ordering key | {@link RealtimeFrame.envelopeSeq} / {@link RealtimeFrame.payloadSeq} |
 * | answer the heartbeat or die every 35 s | the runtime replies `pong` to every `ping` |
 * | a refusal is not a retry | {@link closeDisposition} |
 * | 4401 in a browser is a stale SESSION, not a refusal | {@link RealtimeSessionSeam} |
 * | a socket that never worked is not "reconnecting" | {@link RealtimeDegradation} |
 */
export {
  WIRE_VERSION,
  FRAME_HELLO,
  FRAME_PING,
  FRAME_PONG,
  FRAME_WELCOME,
  FRAME_REPLAY,
  FRAME_REPLAY_DONE,
  FRAME_LIVE,
  FRAME_EPHEMERAL,
  FRAME_RESYNC,
  FRAME_KICK,
  FRAME_ERROR,
  CLIENT_FRAME_TYPES,
  SERVER_FRAME_TYPES,
  PROTOCOL_FRAME_TYPES,
  ERROR_BAD_ENVELOPE,
  ERROR_BAD_TYPE,
  ERROR_UNAUTHORIZED,
  decodeFrame,
  encodeFrame,
  helloFrame,
  pingFrame,
  pongFrame,
} from "./frames.js";
export type { RealtimeFrame } from "./frames.js";

export {
  CLOSE_PROTOCOL_ERROR,
  CLOSE_UNAUTHENTICATED,
  CLOSE_FORBIDDEN,
  CLOSE_STREAM_UNKNOWN,
  CLOSE_HEARTBEAT_TIMEOUT,
  CLOSE_REVOKED,
  CLOSE_OVERFLOW,
  CLOSE_DATA_HOME_UNAVAILABLE,
  CLOSE_ABNORMAL,
  CLOSE_SERVICE_RESTART,
  CLOSE_CODE_NAMES,
  TERMINAL_CLOSE_CODES,
  closeCodeName,
  closeDisposition,
} from "./closeCodes.js";
export type { CloseDisposition } from "./closeCodes.js";

export {
  bearerSubprotocols,
  browserSocketFactory,
  canOpenWebSocket,
  socketOrigin,
} from "./transport.js";
export type {
  RealtimeSocket,
  RealtimeSocketFactory,
  RealtimeSocketHandlers,
} from "./transport.js";

export {
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_DELAY_MS,
  backoffDelay,
  defaultSchedule,
} from "./backoff.js";
export type { BackoffOptions, Cancel, Schedule } from "./backoff.js";

export {
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_HEARTBEAT_TIMEOUT_MS,
  DEFAULT_NEVER_CONNECTED_ATTEMPTS,
  DEFAULT_NEVER_CONNECTED_MS,
  DEFAULT_RECONNECTING_LONG_MS,
  createRealtimeClient,
} from "./client.js";
export type {
  RealtimeClient,
  RealtimeClientOptions,
  RealtimeConnectionState,
  RealtimeDegradation,
  RealtimeDegradationThresholds,
  RealtimeRefusal,
  RealtimeSessionRefresh,
  RealtimeSessionSeam,
  RealtimeState,
  RealtimeStreamState,
  RealtimeStreamStatus,
  RealtimeSubscribeOptions,
  RealtimeSubscription,
  RealtimeUrl,
} from "./client.js";
