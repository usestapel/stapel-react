/**
 * CHAT'S PAYLOADS, on the substrate's envelope.
 *
 * `@stapel/realtime` owns the wire: `{v, type, stream, payload, seq}`, the
 * resume handshake, the heartbeat, the close codes. What is left for a pair —
 * and all that is left — is what its own payloads MEAN. That is this file.
 *
 * ── The two sequences ───────────────────────────────────────────────────────
 *
 * The substrate hands a decoded frame with the two numbers kept apart by name,
 * and chat is the module that taught the fleet why:
 *
 *   `frame.envelopeSeq`  →  the message's `rev_seq` — the RESUME CURSOR.
 *                           Bumped by every edit and every delete.
 *   `frame.payloadSeq`   →  the message's `seq` — its PLACE IN THE THREAD.
 *                           Immutable, gapless, the sort key.
 *
 * `stapel_chat/consumers.py` says it in one line: *"Frame sequence is not
 * message sequence… Getting this backwards makes edits reorder the thread."*
 * The pre-substrate client in this package sent `hello{last_seq: <thread
 * seq>}`, which is the wrong number in the wrong slot: it asked the server to
 * replay from a revision that has nothing to do with what the client holds.
 *
 * ── Frame types this module adds ────────────────────────────────────────────
 *
 * Journal frames (`replay` / `live`) carry {@link ChatMessagePayload} — the
 * one shape `stapel_chat.realtime.message_payload` builds for the REST
 * serializer, the journal frame and the Action alike.
 *
 * Signals carry their OWN type (`chat.read`, `chat.delivered`,
 * `chat.activity`, `chat.inbox`) and structurally cannot carry a `seq`,
 * because nothing persisted them.
 *
 * ── One field the wire and the REST body do not share ───────────────────────
 *
 * `attachments`. REST renders each one through `attachment_to_dto` (an
 * `AttachmentResponse` with CDN geometry); the socket sends
 * `list(msg.attachments or [])`, the raw stored descriptors. So a socket
 * payload is NOT an `AttachmentResponse[]` and is typed here as opaque. It is
 * also the reason a live message is fetched over REST rather than pushed into
 * the thread cache — see `flows/freshness.ts`.
 */
import type { RealtimeFrame } from "@stapel/realtime";
import { FRAME_LIVE, FRAME_REPLAY } from "@stapel/realtime";

// ── signal types (`stapel_chat.realtime`) ────────────────────────────────────

/** A participant's read marker moved. */
export const CHAT_SIGNAL_READ = "chat.read";
/** A participant's delivery marker moved. */
export const CHAT_SIGNAL_DELIVERED = "chat.delivered";
/** A participant is typing / recording / uploading. */
export const CHAT_SIGNAL_ACTIVITY = "chat.activity";
/** Something moved in a conversation this user takes part in (inbox stream). */
export const CHAT_SIGNAL_INBOX = "chat.inbox";
/**
 * A participant connected or went away (`stapel_chat.presence`, 0.7.0).
 *
 * It rides the CONVERSATION stream this thread is already subscribed to, so
 * presence costs no second subscription. Only flips travel: a heartbeat that
 * renews a lease changes nothing anybody is watching.
 *
 * The fact is about **that participant's own sockets**. It is never derived
 * from this client's transport, which knows only whether *this* browser can
 * reach the server — the header that conflated the two is the reason this
 * signal exists.
 */
export const CHAT_SIGNAL_PRESENCE = "chat.presence.changed";

// ── client → server frame types (`stapel_chat.consumers`) ────────────────────

/**
 * Chat's six write frames.
 *
 * The substrate's default posture is that writes go over REST; chat is its
 * ONE documented exception, and a deliberate one — the backend's words: *"a
 * compose box whose Enter key takes a different transport than the messages
 * it produces is the seam where 'realtime was built' stops being true."* Every
 * one of them goes through the same service layer the REST view calls, and
 * carries a `client_msg_id` so a retry after a dropped socket is idempotent
 * rather than a second bubble.
 */
export const CHAT_FRAME_SEND = "send";
export const CHAT_FRAME_EDIT = "edit";
export const CHAT_FRAME_DELETE = "delete";
export const CHAT_FRAME_READ = "read";
export const CHAT_FRAME_DELIVERED = "delivered";
export const CHAT_FRAME_ACTIVITY = "activity";

/**
 * `error{code}` values chat adds to the substrate's three.
 *
 * They are SOCKET-LOCAL: none of them is an `error.<status>.<code>` key from
 * the module's registry, so none has an i18n key or a remediation. A surface
 * that shows a person one of these strings is showing them a protocol
 * fragment — which is exactly why {@link ChatWriteRefusal} exists and why the
 * REST path stays the default for a composer.
 */
export const CHAT_WS_ERRORS = {
  empty: "empty",
  tooLong: "too_long",
  attachmentsDisabled: "attachments_disabled",
  invalidAttachment: "invalid_attachment",
  unknownAttachmentType: "unknown_attachment_type",
  invalidReply: "invalid_reply",
  notFound: "not_found",
  notAuthor: "not_author",
  notEditable: "not_editable",
  deleted: "deleted",
  unknownActivity: "unknown_activity",
  sendRefused: "send_refused",
  unavailable: "unavailable",
} as const;

/** One socket-local refusal code. */
export type ChatWriteRefusal = (typeof CHAT_WS_ERRORS)[keyof typeof CHAT_WS_ERRORS];

/** Activity states `stapel_chat.activity` registers. */
export const CHAT_ACTIVITY_STATES = ["typing", "recording", "uploading"] as const;
export type ChatActivityState = (typeof CHAT_ACTIVITY_STATES)[number];

// ── payloads (server → client) ───────────────────────────────────────────────

/**
 * `stapel_chat.realtime.message_payload`, field for field.
 *
 * A tombstone keeps `message_id`, `seq`, `sender_id` and `created_at` and
 * loses everything else — the id keeps arriving so a cache knows which row to
 * purge.
 */
export interface ChatMessagePayload {
  readonly message_id: string;
  readonly conversation_id: string;
  readonly sender_id: string | null;
  /** Place in the thread. The SORT KEY — never a resume cursor. */
  readonly seq: number;
  /** Place in the revision journal. The RESUME CURSOR — never a sort key. */
  readonly rev_seq: number;
  readonly kind: string;
  readonly body: string;
  readonly reply_to: string | null;
  /** Raw stored descriptors — NOT the REST `AttachmentResponse` shape. */
  readonly attachments: readonly unknown[];
  /** The sender's own idempotency key, echoed back. */
  readonly client_msg_id: string | null;
  readonly edited: boolean;
  readonly edited_at: string | null;
  readonly deleted: boolean;
  readonly deleted_at: string | null;
  readonly created_at: string;
}

/** `chat.read` / `chat.delivered` — a participant's marker moved. */
export interface ChatMarkerPayload {
  readonly conversation_id: string;
  readonly user_id: string;
  readonly seq: number;
}

/** `chat.activity` — "typing…", with the client's own expiry hint. */
export interface ChatActivityPayload {
  readonly conversation_id: string;
  readonly user_id: string;
  readonly state: string;
  readonly ttl_s: number;
}

/**
 * `chat.presence.changed` — a participant connected or went away.
 *
 * `last_seen_at` travels WITH the flip so an offline header can say when
 * without a round trip. `null` means this deployment has never seen that user
 * connect — which is a different fact from "seen long ago", and a header must
 * say nothing rather than invent a date.
 */
export interface ChatPresencePayload {
  readonly conversation_id: string;
  readonly user_id: string;
  readonly online: boolean;
  readonly last_seen_at: string | null;
}

/** `chat.inbox` — a conversation this user takes part in moved. */
export interface ChatInboxPayload {
  readonly conversation_id: string;
  readonly conversation_kind: string;
  readonly last_seq: number;
  readonly message: ChatMessagePayload | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function flag(value: unknown): boolean {
  return value === true;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** True for the two journal frame types that carry a message. */
export function isChatMessageFrame(frame: RealtimeFrame): boolean {
  return frame.type === FRAME_LIVE || frame.type === FRAME_REPLAY;
}

/**
 * Read a message payload, or `null` when the object is not one.
 *
 * `null` is a decision, not laziness — the same one the substrate makes about
 * an unreadable envelope. A payload this build cannot read must not be turned
 * into a half-message: the store would then hold a row nobody can reconcile
 * with the REST answer for the same id.
 *
 * `rev_seq` falls back to the ENVELOPE's seq when the payload omits it,
 * because on a journal frame they are the same number by construction
 * (`deliver_frame(..., seq=msg.rev_seq)`) — and never to `seq`, which is the
 * confusion this whole file exists to prevent.
 */
export function readChatMessagePayload(
  payload: Readonly<Record<string, unknown>>,
  envelopeSeq?: number | undefined
): ChatMessagePayload | null {
  const messageId = str(payload["message_id"]);
  const conversationId = str(payload["conversation_id"]);
  const seq = num(payload["seq"]);
  const createdAt = str(payload["created_at"]);
  if (messageId === null || conversationId === null || seq === null || createdAt === null) {
    return null;
  }
  const revSeq = num(payload["rev_seq"]) ?? envelopeSeq;
  if (revSeq === undefined) return null;
  const attachments = payload["attachments"];
  return {
    message_id: messageId,
    conversation_id: conversationId,
    sender_id: str(payload["sender_id"]),
    seq,
    rev_seq: revSeq,
    kind: str(payload["kind"]) ?? "text",
    body: str(payload["body"]) ?? "",
    reply_to: str(payload["reply_to"]),
    attachments: Array.isArray(attachments) ? [...attachments] : [],
    client_msg_id: str(payload["client_msg_id"]),
    edited: flag(payload["edited"]),
    edited_at: str(payload["edited_at"]),
    deleted: flag(payload["deleted"]),
    deleted_at: str(payload["deleted_at"]),
    created_at: createdAt,
  };
}

/** The message on a `replay`/`live` frame, or `null` for anything else. */
export function readChatMessageFrame(frame: RealtimeFrame): ChatMessagePayload | null {
  if (!isChatMessageFrame(frame)) return null;
  return readChatMessagePayload(frame.payload, frame.envelopeSeq);
}

/**
 * A read/delivery marker. The two signals differ only in which field carries
 * the number, so both are normalized onto `seq` here.
 */
export function readChatMarkerFrame(frame: RealtimeFrame): ChatMarkerPayload | null {
  if (frame.type !== CHAT_SIGNAL_READ && frame.type !== CHAT_SIGNAL_DELIVERED) {
    return null;
  }
  const conversationId = str(frame.payload["conversation_id"]);
  const userId = str(frame.payload["user_id"]);
  const seq =
    num(frame.payload["last_read_seq"]) ?? num(frame.payload["last_delivered_seq"]);
  if (conversationId === null || userId === null || seq === null) return null;
  return { conversation_id: conversationId, user_id: userId, seq };
}

/** A `chat.activity` signal. */
export function readChatActivityFrame(frame: RealtimeFrame): ChatActivityPayload | null {
  if (frame.type !== CHAT_SIGNAL_ACTIVITY) return null;
  const conversationId = str(frame.payload["conversation_id"]);
  const userId = str(frame.payload["user_id"]);
  const state = str(frame.payload["state"]);
  if (conversationId === null || userId === null || state === null) return null;
  return {
    conversation_id: conversationId,
    user_id: userId,
    state,
    ttl_s: num(frame.payload["ttl_s"]) ?? 0,
  };
}

/** A `chat.presence.changed` signal. */
export function readChatPresenceFrame(
  frame: RealtimeFrame
): ChatPresencePayload | null {
  if (frame.type !== CHAT_SIGNAL_PRESENCE) return null;
  const conversationId = str(frame.payload["conversation_id"]);
  const userId = str(frame.payload["user_id"]);
  if (conversationId === null || userId === null) return null;
  // `online` is read with `flag()`: anything that is not literally `true` is
  // not online. A truthy-but-wrong value (a string, a 1) must not be able to
  // paint somebody present — this whole surface exists because "online" was
  // being asserted from the wrong evidence.
  return {
    conversation_id: conversationId,
    user_id: userId,
    online: flag(frame.payload["online"]),
    last_seen_at: str(frame.payload["last_seen_at"]),
  };
}

/** A `chat.inbox` signal — the conversation-list stream's only frame. */
export function readChatInboxFrame(frame: RealtimeFrame): ChatInboxPayload | null {
  if (frame.type !== CHAT_SIGNAL_INBOX) return null;
  const conversationId = str(frame.payload["conversation_id"]);
  if (conversationId === null) return null;
  const message = record(frame.payload["message"]);
  return {
    conversation_id: conversationId,
    conversation_kind: str(frame.payload["conversation_kind"]) ?? "",
    last_seq: num(frame.payload["last_seq"]) ?? 0,
    message: message === null ? null : readChatMessagePayload(message),
  };
}

// ── write frames (client → server) ───────────────────────────────────────────

/** The `send` frame's payload. `client_msg_id` is what makes a retry safe. */
export interface ChatSendPayload {
  readonly body: string;
  readonly client_msg_id: string;
  readonly reply_to?: string;
  readonly attachments?: readonly unknown[];
}

export interface ChatEditPayload {
  readonly message_id: string;
  readonly body: string;
}

export interface ChatDeletePayload {
  readonly message_id: string;
}

/** `read` and `delivered` share one payload (`consumers._do_marker`). */
export interface ChatMarkerFramePayload {
  readonly upto_seq: number;
}

export interface ChatActivityFramePayload {
  readonly state: string;
}

/**
 * A client-generated idempotency key.
 *
 * `crypto.randomUUID` where the environment has it (every browser this pair
 * supports, and node ≥ 19), and a time-plus-entropy fallback where it does
 * not — a key that is merely unlikely to collide is still a working
 * idempotency key, and refusing to send without `crypto` would take the
 * socket path away from an environment that can otherwise use it.
 */
export function chatClientMessageId(): string {
  const cryptoRef: Crypto | undefined =
    typeof globalThis.crypto === "undefined" ? undefined : globalThis.crypto;
  if (cryptoRef !== undefined && typeof cryptoRef.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  return `cmid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
