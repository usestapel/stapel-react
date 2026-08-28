import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  ChatMessage,
  Conversation,
  ConversationKind,
  ConversationListParams,
  ConversationPage,
  MessageHistoryParams,
  MessagePage,
  SendMessageRequest,
  SubjectRef,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors auth-react): the
 * simplest SPA rule is to always send `X-Requested-With: XMLHttpRequest` on
 * mutating requests. Header-token clients ignore it; it is harmless there, so
 * every mutation carries it.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/** Anchor/direction/limit → a query object, omitting what was not asked for. */
function pageQuery(
  params: ConversationListParams | MessageHistoryParams | undefined
): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (params?.anchor !== undefined) query.anchor = params.anchor;
  if (params?.direction !== undefined) query.direction = params.direction;
  if (params?.limit !== undefined) query.limit = params.limit;
  return query;
}

/**
 * The pair's typed operation surface — one method per stapel-chat endpoint a
 * buyer/seller client may call, bound to the injected {@link StapelClient}
 * (the per-module override seam of frontend-standard §7.2). Paths are relative
 * to the runtime's `baseUrl` (`/chat/api/v1`).
 *
 * **WRITES NEVER GO OVER THE SOCKET.** stapel-chat's `ChatConsumer` accepts a
 * `send` frame, and this pair deliberately does not use it: a message is a
 * durable row with a locked `seq` allocation, and the REST path is the one
 * that answers with the persisted row (and with a real error envelope when it
 * refuses). The socket is a delivery convenience over that journal — see
 * `src/realtime/`.
 *
 * The support-operator half of the module (`/support/queue`, assign / resolve
 * / reopen) is intentionally absent: it is an operator console, not the
 * buyer-and-seller surface this pair ships (spec §4.5 "Not in MVP").
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2; until then they are hand-authored here (the ONE legal home of path
 * strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface ChatApi {
  readonly client: StapelClient;

  /** A page of the caller's conversations, newest activity first. */
  conversations(params?: ConversationListParams): Promise<ConversationPage>;
  /** One conversation (participant-only; 403 otherwise). */
  conversation(conversationId: string): Promise<Conversation>;
  /**
   * Get-or-create a conversation. For `direct`, `participantIds` must name
   * exactly one OTHER user: the thread is keyed by the (order-independent)
   * participant pair, so a second call returns the same row — the idempotency
   * "message the seller" is built on.
   *
   * `subject` NARROWS that key. Since stapel-chat 0.6.0 `direct_key` is
   * computed over `(scope, {both user ids}, subject_type, subject_key)`, so a
   * buyer writing about listing A and the same buyer writing to the same
   * seller about listing B get two threads, each of which can say what it is
   * about. Omit it and the pair-only key is unchanged.
   */
  createConversation(
    kind: ConversationKind,
    participantIds?: readonly string[],
    subject?: SubjectRef
  ): Promise<Conversation>;
  /** A page of message history, anchored on `seq` (see {@link MessageHistoryParams}). */
  messages(
    conversationId: string,
    params?: MessageHistoryParams
  ): Promise<MessagePage>;
  /** Append a message. Resolves with the persisted row, carrying its `seq`. */
  sendMessage(
    conversationId: string,
    body: SendMessageRequest
  ): Promise<ChatMessage>;
  /**
   * Advance the caller's read marker. The server never moves it backwards
   * (`services.mark_read`), and neither does this pair — see
   * `model/readMarker.ts`.
   */
  markRead(conversationId: string, uptoSeq: number): Promise<void>;
}

export function createChatApi(client: StapelClient): ChatApi {
  const conversationPath = (id: string): string =>
    `/conversations/${encodeURIComponent(id)}`;

  return {
    client,

    conversations: (params) =>
      client.get("/conversations", { query: pageQuery(params) }),

    conversation: (conversationId) => client.get(conversationPath(conversationId)),

    createConversation: (kind, participantIds, subject) =>
      client.post(
        "/conversations",
        {
          kind,
          ...(participantIds !== undefined
            ? { participant_ids: [...participantIds] }
            : {}),
          // Both fields or neither: half a pair is refused upstream
          // (`chat_incomplete_subject`), and sending an empty string for the
          // missing half would key the thread on "".
          ...(subject !== undefined
            ? { subject_type: subject.type, subject_key: subject.key }
            : {}),
        },
        mutating()
      ),

    messages: (conversationId, params) =>
      client.get(`${conversationPath(conversationId)}/messages`, {
        query: pageQuery(params),
      }),

    sendMessage: (conversationId, body) =>
      client.post(
        `${conversationPath(conversationId)}/messages`,
        body,
        mutating()
      ),

    markRead: (conversationId, uptoSeq) =>
      client.post(
        `${conversationPath(conversationId)}/read`,
        { upto_seq: uptoSeq },
        mutating()
      ),
  };
}
