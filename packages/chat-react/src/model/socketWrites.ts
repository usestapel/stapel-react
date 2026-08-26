/**
 * CHAT'S SOCKET-WRITE SEAM — the substrate's one documented exception.
 *
 * `@stapel/realtime`'s default posture is that writes go over REST, and every
 * other pair in the fleet obeys it. Chat does not, and the backend says why in
 * `stapel_chat/consumers.py`: *"a compose box whose Enter key takes a
 * different transport than the messages it produces is the seam where
 * 'realtime was built' stops being true."* The six write frames go through the
 * same service layer the REST views call — one validation path, one emit, one
 * fan-out.
 *
 * ── What this seam is, and what it is not ──────────────────────────────────
 *
 * It is the typed way to emit those six frames, so a host that wants the
 * socket write path does not hand-roll an envelope beside the substrate's. It
 * is NOT this pair's default composer: `useSendMessage` still posts over REST,
 * because the socket's refusals are socket-local codes (`empty`, `too_long`,
 * `send_refused`, …) that are not in the module's error registry, so they have
 * no i18n key and no remediation — while `POST …/messages` answers with the
 * persisted row and a real error envelope. A `false` return here means "no
 * open socket", which is exactly when the REST twin is the right call.
 *
 * ── client_msg_id ──────────────────────────────────────────────────────────
 *
 * Every `send` carries one, and it is the whole reason a socket write is safe
 * to retry: the server echoes it back on the fan-out
 * (`message_payload.client_msg_id`), so a client that resent after a dropped
 * socket reconciles the two into one bubble instead of showing two. It is
 * generated here when the caller does not supply one, and RETURNED, because a
 * key the caller cannot see is a key it cannot reconcile against.
 */
import { CHAT_FRAME_ACTIVITY, CHAT_FRAME_DELETE, CHAT_FRAME_DELIVERED, CHAT_FRAME_EDIT, CHAT_FRAME_READ, CHAT_FRAME_SEND, chatClientMessageId } from "../realtime/frames.js";
import type { ChatActivityState } from "../realtime/frames.js";

/** What `useChatFreshness` hands over: one frame on this stream. */
export type ChatFrameSender = (
  type: string,
  payload?: Readonly<Record<string, unknown>>
) => boolean;

export interface ChatSendOverSocket {
  /** The idempotency key that travelled, or `null` when nothing did. */
  readonly clientMsgId: string | null;
  readonly sent: boolean;
}

export interface ChatSocketWrites {
  /** There is an open socket to write to right now. */
  readonly available: boolean;
  send(body: string, options?: {
    readonly replyTo?: string;
    readonly clientMsgId?: string;
    readonly attachments?: readonly unknown[];
  }): ChatSendOverSocket;
  edit(messageId: string, body: string): boolean;
  remove(messageId: string): boolean;
  markRead(uptoSeq: number): boolean;
  markDelivered(uptoSeq: number): boolean;
  announceActivity(state: ChatActivityState): boolean;
}

/**
 * Bind the six write frames to one stream's sender. Pure — a test drives it
 * with a recording sender and asserts the frames, which is the only thing
 * about a write frame that can be wrong.
 */
export function createChatSocketWrites(
  send: ChatFrameSender,
  available: boolean
): ChatSocketWrites {
  return {
    available,
    send: (body, options) => {
      const clientMsgId = options?.clientMsgId ?? chatClientMessageId();
      const sent = send(CHAT_FRAME_SEND, {
        body,
        client_msg_id: clientMsgId,
        ...(options?.replyTo !== undefined ? { reply_to: options.replyTo } : {}),
        ...(options?.attachments !== undefined
          ? { attachments: [...options.attachments] }
          : {}),
      });
      return { clientMsgId: sent ? clientMsgId : null, sent };
    },
    edit: (messageId, body) =>
      send(CHAT_FRAME_EDIT, { message_id: messageId, body }),
    remove: (messageId) => send(CHAT_FRAME_DELETE, { message_id: messageId }),
    markRead: (uptoSeq) => send(CHAT_FRAME_READ, { upto_seq: uptoSeq }),
    markDelivered: (uptoSeq) => send(CHAT_FRAME_DELIVERED, { upto_seq: uptoSeq }),
    announceActivity: (state) => send(CHAT_FRAME_ACTIVITY, { state }),
  };
}
