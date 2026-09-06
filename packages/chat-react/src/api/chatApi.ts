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
 * The conversation list's own filters on top of the paging trio — `search`
 * and `unread` (stapel-chat 0.8.2), and `left` (0.8.6).
 *
 * ALL THREE ARE OMITTED RATHER THAN SENT EMPTY. `search=`, `unread=false` and
 * `left=false` are "no filter" to the server, so sending them buys nothing
 * and costs a distinct URL for every state a toolbar passes through — which
 * is a distinct cache entry and a request per keystroke of an empty box.
 */
function conversationQuery(
  params: ConversationListParams | undefined
): Record<string, string | number> {
  const query = pageQuery(params);
  const search = params?.search?.trim() ?? "";
  if (search !== "") query.search = search;
  if (params?.unread === true) query.unread = "true";
  if (params?.left === true) query.left = "true";
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

  /**
   * A page of the caller's conversations, newest activity first — narrowed by
   * `search` / `unread` where they are given (stapel-chat 0.8.2: both filter
   * BEFORE the page is taken).
   *
   * `params.left` swaps the list for its exact complement — the threads this
   * person has LEFT, newest departure first (stapel-chat 0.8.6). One method,
   * because it is one endpoint with one paging contract and one filter
   * vocabulary; what differs is what `anchor` is a value OF, and that belongs
   * in the caller's cache key rather than in a second function.
   */
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
  /**
   * LEAVE the conversation (stapel-chat 0.8.5). `204`, and `204` again on a
   * retry.
   *
   * `DELETE` on this URL is the caller leaving, and the verb is the one thing
   * about it that can be misread: it deletes NOTHING. The messages stay, the
   * other party's copy of the thread is untouched, the leaver still reaches
   * their own history by id, and the participant row is kept (stamped
   * `left_at`) because it carries the read markers and is what a direct
   * thread's uniqueness is built on. What changes is one person's inbox: the
   * thread drops off their list, out of their unread counts and out of
   * `?search=`, and their live subscription to it is revoked.
   *
   * IDEMPOTENT BY CONTRACT — a client that lost the response and retried, and
   * a client leaving a thread it already left, are the same request and get
   * the same `204`; the second call writes no second system line. A caller who
   * is not a party gets `error.403.chat_not_participant`, the same answer
   * `GET` on this exact URL gives them.
   */
  leaveConversation(conversationId: string): Promise<void>;
  /**
   * TAKE BACK A DEPARTURE (stapel-chat 0.8.6). `204`, and `204` again on a
   * retry.
   *
   * A named POST beside `read` rather than a `PATCH` clearing a field —
   * `left_at` has exactly one legal value on the way back and the server is
   * the one who writes it, so there is no body to send and none is sent.
   *
   * What it does NOT touch is the whole content of it: read markers stay, so
   * the thread returns with the badge it had, and `updated_at` stays, so it
   * returns where the departure left it rather than at the top of the inbox.
   * No participant row is created — a caller who is not a party gets
   * `error.403.chat_not_participant`, the same key `GET` and `DELETE` on that
   * thread give them: this is an undo, never a door into a conversation
   * nobody put you in.
   *
   * ON A 0.8.5 SERVER THIS URL DOES NOT EXIST AND ANSWERS `404`. That is the
   * pair's feature detection, and the only one available: `?left=true` is
   * silently ignored by a server that has never heard of it (an unknown query
   * parameter is not an error), so a listing cannot tell the two apart — the
   * refusal on the way back can. See `useRejoinConversation`.
   */
  rejoinConversation(conversationId: string): Promise<void>;
}

export function createChatApi(client: StapelClient): ChatApi {
  const conversationPath = (id: string): string =>
    `/conversations/${encodeURIComponent(id)}`;

  return {
    client,

    conversations: (params) =>
      client.get("/conversations", { query: conversationQuery(params) }),

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

    // 204 No Content: there is no body to type, and `void` is what the
    // caller gets rather than an empty object it might be tempted to read.
    leaveConversation: (conversationId) =>
      client.delete(conversationPath(conversationId), mutating()),

    // `undefined`, not `{}`: the operation declares `requestBody?: never`, and
    // an empty object would put a `Content-Type: application/json` and two
    // bytes on the wire to say nothing.
    rejoinConversation: (conversationId) =>
      client.post(`${conversationPath(conversationId)}/rejoin`, undefined, mutating()),
  };
}
