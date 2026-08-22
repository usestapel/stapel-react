/**
 * The stapel-chat WebSocket protocol, typed.
 *
 * This is a MIRROR of the module's own contract, not an invention:
 * `stapel_chat/consumers.py` (`ChatConsumer`) and `stapel_chat/realtime.py`
 * (`message_frame`) are the source, and `MODULE.md` §"Realtime protocol"
 * states it in one line:
 *
 * ```
 * client → server:  hello{last_seq} / send{body,attachments,reply_to} / ack{seq} / ping
 * server → client:  welcome{server_seq} / message{…seq} / replay_done{up_to_seq} / error{code,message} / pong
 * ```
 *
 * The WS surface is invisible to `schema.json` (OpenAPI describes HTTP), so
 * these types cannot be generated today — the realtime spec (§8) parks the
 * frame contract in the `events.json` family for later. Until then this file
 * is the pair's declared mirror and `test/frames.test.ts` pins it against the
 * shapes the consumer actually sends.
 *
 * Nothing here imports React or `@stapel/core`: it is plain protocol, so the
 * future `@stapel/realtime` substrate can subsume it without dragging the UI.
 */

/**
 * Widest resume gap the server replays inline (`consumers.REPLAY_LIMIT`).
 * Past it the server answers `error{resync}` instead, and the client
 * re-hydrates from the REST history. Mirrored here so the client can SAY that
 * before the server has to.
 */
export const CHAT_WS_REPLAY_LIMIT = 500;

/** `ChatConsumer.connect()` closes with this when `scope["user"]` is unset. */
export const CHAT_WS_CLOSE_UNAUTHENTICATED = 4401;
/** …and with this when the caller is not a participant of the conversation. */
export const CHAT_WS_CLOSE_NOT_PARTICIPANT = 4403;

// ── client → server ──────────────────────────────────────────────────────────

/** Resume: replay everything after `last_seq`, then go live. */
export interface ChatHelloFrame {
  readonly type: "hello";
  readonly last_seq: number;
}

/**
 * Append a message over the socket.
 *
 * TYPED BUT NEVER SENT BY THIS CLIENT, on purpose. The frame is part of the
 * module's contract, so a mirror that omitted it would be an incomplete
 * mirror; but this pair posts messages over REST (`ChatApi.sendMessage`),
 * where the answer is the persisted row and a refusal is a real error
 * envelope. Over the socket a refusal is an `error` frame with a
 * socket-local code (`empty` / `too_long` / `attachments_disabled` /
 * `invalid_reply`) that is NOT in the module's error registry, so it has no
 * i18n key and no remediation — the UI could not tell the person what went
 * wrong. `createChatSocket` exposes no method that emits this.
 */
export interface ChatSendFrame {
  readonly type: "send";
  readonly body?: string;
  readonly attachments?: readonly string[];
  readonly reply_to?: string | null;
}

/** Delivery acknowledgement — the server tracks it, nothing depends on it. */
export interface ChatAckFrame {
  readonly type: "ack";
  readonly seq: number;
}

/** Liveness probe; answered with `pong`. */
export interface ChatPingFrame {
  readonly type: "ping";
}

export type ChatClientFrame =
  | ChatHelloFrame
  | ChatSendFrame
  | ChatAckFrame
  | ChatPingFrame;

// ── server → client ──────────────────────────────────────────────────────────

/** Answer to `hello`: the conversation's high-water mark right now. */
export interface ChatWelcomeFrame {
  readonly type: "welcome";
  readonly conversation_id: string;
  readonly server_seq: number;
}

/**
 * A message, replayed or live — the same frame either way (that is what makes
 * the overlap after a resume harmless: it is seq-deduped on both ends).
 * Field-for-field `stapel_chat.realtime.message_frame`.
 */
export interface ChatMessageFrame {
  readonly type: "message";
  readonly message_id: string;
  readonly conversation_id: string;
  readonly sender_id: string | null;
  readonly seq: number;
  readonly kind: string;
  readonly body: string;
  readonly reply_to: string | null;
  readonly attachments: readonly string[];
  readonly created_at: string;
}

/** End of the replay window — everything up to `up_to_seq` has been sent. */
export interface ChatReplayDoneFrame {
  readonly type: "replay_done";
  readonly up_to_seq: number;
}

/**
 * A protocol-level refusal. `code` is a SOCKET-LOCAL vocabulary
 * (`resync` / `bad_type` / the send-path codes), NOT a `error.<status>.<code>`
 * key from the module's error registry — which is exactly why the only one
 * this pair acts on is `resync`.
 */
export interface ChatErrorFrame {
  readonly type: "error";
  readonly code: string;
  readonly message: string;
}

/** Answer to `ping`. */
export interface ChatPongFrame {
  readonly type: "pong";
}

export type ChatServerFrame =
  | ChatWelcomeFrame
  | ChatMessageFrame
  | ChatReplayDoneFrame
  | ChatErrorFrame
  | ChatPongFrame;

/** The one error code that means "stop replaying, re-read the journal". */
export const CHAT_WS_RESYNC = "resync";

// ── parsing (the wire is untrusted structured text) ──────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Narrow one decoded server frame, or `null` for anything this build does not
 * understand (an unknown `type`, a missing field, a `seq` that is not a
 * number). Unknown is DROPPED, never coerced: a frame this client cannot read
 * must not advance the seq cursor, or the gap it leaves is invisible.
 */
export function parseServerFrame(value: unknown): ChatServerFrame | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case "welcome": {
      const conversationId = str(value.conversation_id);
      const serverSeq = num(value.server_seq);
      if (conversationId === null || serverSeq === null) return null;
      return {
        type: "welcome",
        conversation_id: conversationId,
        server_seq: serverSeq,
      };
    }
    case "message": {
      const seq = num(value.seq);
      const messageId = str(value.message_id);
      const conversationId = str(value.conversation_id);
      const createdAt = str(value.created_at);
      if (
        seq === null ||
        messageId === null ||
        conversationId === null ||
        createdAt === null
      ) {
        return null;
      }
      const attachments = Array.isArray(value.attachments)
        ? value.attachments.filter((a): a is string => typeof a === "string")
        : [];
      return {
        type: "message",
        message_id: messageId,
        conversation_id: conversationId,
        sender_id: str(value.sender_id),
        seq,
        kind: str(value.kind) ?? "text",
        body: str(value.body) ?? "",
        reply_to: str(value.reply_to),
        attachments,
        created_at: createdAt,
      };
    }
    case "replay_done": {
      const upTo = num(value.up_to_seq);
      if (upTo === null) return null;
      return { type: "replay_done", up_to_seq: upTo };
    }
    case "error": {
      const code = str(value.code);
      if (code === null) return null;
      return { type: "error", code, message: str(value.message) ?? "" };
    }
    case "pong":
      return { type: "pong" };
    default:
      return null;
  }
}

/** Decode a socket payload (JSON text) into a frame, or `null`. */
export function decodeServerFrame(data: unknown): ChatServerFrame | null {
  if (typeof data !== "string") return null;
  try {
    return parseServerFrame(JSON.parse(data));
  } catch {
    return null;
  }
}
