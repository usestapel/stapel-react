/**
 * Wire envelope **v1** — the client mirror of `stapel_realtime/envelope.py`.
 *
 * Every frame, both directions, is one shape:
 *
 * ```json
 * {"v": 1, "type": "live", "stream": "chat:conv:7", "payload": {…}, "seq": 42}
 * ```
 *
 * Two rules from the server half are load-bearing here and are the reason this
 * file exists instead of an ad-hoc parser per pair:
 *
 * 1. **Frame kind is structural, not a flag.** `seq` present ⇒ a journal frame
 *    (`replay`/`live`); absent ⇒ ephemeral. Nothing persisted an ephemeral
 *    frame, so it physically cannot carry one. There is no mode field to get
 *    wrong, and a courtesy frame can never be mistaken for journal state.
 * 2. **The two sequences are different numbers with the same name on the
 *    wire.** `envelope.seq` is the module's `rev_seq` — the RESUME CURSOR you
 *    hand back in `hello{last_seq}`. `payload.seq` is the row's place in its
 *    own ordering (a message's place in a thread) — the SORT KEY. Conflating
 *    them silently drops every edit and every tombstone that happened while a
 *    client was away, which is exactly what the pre-substrate chat client did.
 *    So this module never exposes a field called `seq`: a decoded frame
 *    carries {@link RealtimeFrame.envelopeSeq} and
 *    {@link RealtimeFrame.payloadSeq}, and you cannot reach for the wrong one
 *    by accident.
 *
 * A frame whose `type` the protocol does not own is a SIGNAL, delivered
 * verbatim under the module's own name (`chat.read`, `recording.status`). That
 * is why the reserved list below is a list and not a comment: with signals and
 * protocol sharing one `type` field, it is the only thing keeping a courtesy
 * frame from being read as protocol.
 */

/** Envelope version carried by every frame (`envelope.py:WIRE_VERSION`). */
export const WIRE_VERSION = 1;

// ── protocol frame types (envelope.py:46-57) ────────────────────────────────
// client → server
export const FRAME_HELLO = "hello";
export const FRAME_PING = "ping";
export const FRAME_PONG = "pong";
// server → client
export const FRAME_WELCOME = "welcome";
export const FRAME_REPLAY = "replay";
export const FRAME_REPLAY_DONE = "replay_done";
export const FRAME_LIVE = "live";
export const FRAME_EPHEMERAL = "ephemeral";
export const FRAME_RESYNC = "resync";
export const FRAME_KICK = "kick";
export const FRAME_ERROR = "error";

/** Frames a client may send. Anything else answers `error{code=bad_type}`. */
export const CLIENT_FRAME_TYPES: readonly string[] = [
  FRAME_HELLO,
  FRAME_PING,
  FRAME_PONG,
];

/** Frames the server may send as PROTOCOL (`envelope.py:64-66`). */
export const SERVER_FRAME_TYPES: readonly string[] = [
  FRAME_WELCOME,
  FRAME_REPLAY,
  FRAME_REPLAY_DONE,
  FRAME_LIVE,
  FRAME_RESYNC,
  FRAME_KICK,
  FRAME_ERROR,
  FRAME_PING,
  FRAME_PONG,
];

/**
 * Every name the protocol owns, including the two it does not currently emit
 * (`ephemeral`, kept reserved so no signal may claim it, and the client half).
 * A frame whose type is NOT in here is a signal.
 */
export const PROTOCOL_FRAME_TYPES: ReadonlySet<string> = new Set<string>([
  ...CLIENT_FRAME_TYPES,
  ...SERVER_FRAME_TYPES,
  FRAME_EPHEMERAL,
]);

/**
 * `error` codes the substrate itself emits (`envelope.py:76-78`). A module may
 * add its own — chat contributes `empty`, `too_long`, `not_author`, … — so a
 * reader must never assume this list is exhaustive.
 *
 * `resync` is deliberately NOT here: it is a frame type, not an error. A
 * resume gap wider than the replay window is a normal instruction to
 * re-hydrate over REST, and the socket stays open.
 */
export const ERROR_BAD_ENVELOPE = "bad_envelope";
export const ERROR_BAD_TYPE = "bad_type";
export const ERROR_UNAUTHORIZED = "unauthorized";

/** A decoded inbound envelope. */
export interface RealtimeFrame {
  /** Protocol name (`live`) or the signal's own name (`chat.activity`). */
  readonly type: string;
  /**
   * The stream key this frame belongs to (`<mod>:<scope>:<id>[:<topic>]`).
   * Populated by the server on every frame; it is what makes routing several
   * streams over one socket possible. `undefined` only from a server old
   * enough to have omitted it.
   */
  readonly stream: string | undefined;
  readonly payload: Readonly<Record<string, unknown>>;
  /**
   * `envelope.seq` — the **resume cursor**. Hand the highest one you hold back
   * as `hello{last_seq}` and the server replays exactly the gap. `undefined`
   * ⇒ this frame is ephemeral and nothing persisted it.
   */
  readonly envelopeSeq: number | undefined;
  /**
   * `payload.seq` — the module's **ordering key** inside the stream (a
   * message's place in its thread). Never a resume cursor: an edit or a
   * tombstone re-arrives with its EXISTING `payloadSeq` and a NEW
   * `envelopeSeq`. `undefined` when the module's payload has no ordering.
   */
  readonly payloadSeq: number | undefined;
  /** `envelopeSeq !== undefined` — the structural journal/ephemeral split. */
  readonly journal: boolean;
  /** The protocol does not own this `type`, so it is a module signal. */
  readonly signal: boolean;
}

function readSeq(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  // The wire is JSON; a module that serializes a bigint id as a string must
  // not silently become "no cursor at all".
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return undefined;
}

/**
 * Decode one inbound message into a {@link RealtimeFrame}, or `null` when it
 * is not a v1 envelope.
 *
 * `null` is a decision, not laziness: an unreadable frame must NOT advance the
 * resume cursor, because the gap it would hide is the exact thing resume-by-seq
 * exists to close. An unknown `type` decodes fine (a signal's type is the
 * module's word); an unknown `v` does not, because the shape underneath it is
 * then unknown.
 */
export function decodeFrame(raw: unknown): RealtimeFrame | null {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record["v"] !== WIRE_VERSION) return null;
  const type = record["type"];
  if (typeof type !== "string" || type === "") return null;

  const rawPayload = record["payload"];
  let payload: Record<string, unknown> = {};
  if (rawPayload !== undefined && rawPayload !== null) {
    if (
      typeof rawPayload !== "object" ||
      Array.isArray(rawPayload)
    ) {
      return null;
    }
    payload = rawPayload as Record<string, unknown>;
  }

  const rawStream = record["stream"];
  if (rawStream !== undefined && rawStream !== null && typeof rawStream !== "string") {
    return null;
  }
  const rawEnvelopeSeq = record["seq"];
  if (rawEnvelopeSeq !== undefined && rawEnvelopeSeq !== null) {
    if (readSeq(rawEnvelopeSeq) === undefined) return null;
  }

  const envelopeSeq =
    rawEnvelopeSeq === undefined || rawEnvelopeSeq === null
      ? undefined
      : readSeq(rawEnvelopeSeq);

  return {
    type,
    stream: typeof rawStream === "string" ? rawStream : undefined,
    payload,
    envelopeSeq,
    payloadSeq: readSeq(payload["seq"]),
    journal: envelopeSeq !== undefined,
    signal: !PROTOCOL_FRAME_TYPES.has(type),
  };
}

/**
 * Build an outbound envelope as the JSON text the socket sends. `stream` is
 * always written when known — the server ignores it under the v1
 * socket-per-stream topology and needs it the moment a socket carries more
 * than one.
 */
export function encodeFrame(
  type: string,
  payload?: Readonly<Record<string, unknown>>,
  stream?: string
): string {
  const envelope: Record<string, unknown> = {
    v: WIRE_VERSION,
    type,
    payload: payload ?? {},
  };
  if (stream !== undefined) envelope["stream"] = stream;
  return JSON.stringify(envelope);
}

/**
 * The subscribe/resubscribe frame. `lastSeq` is the highest ENVELOPE seq the
 * consumer holds (`0` = replay everything). The server re-runs `authorize()`
 * on every hello, so this is also how a stream is (re)subscribed.
 */
export function helloFrame(stream: string, lastSeq: number): string {
  return encodeFrame(FRAME_HELLO, { last_seq: Math.max(0, Math.trunc(lastSeq)) }, stream);
}

/** The heartbeat answer. Not sending this is what makes the server close 4408. */
export function pongFrame(stream?: string): string {
  return encodeFrame(FRAME_PONG, {}, stream);
}

/** A client-initiated liveness probe. */
export function pingFrame(stream?: string): string {
  return encodeFrame(FRAME_PING, {}, stream);
}
