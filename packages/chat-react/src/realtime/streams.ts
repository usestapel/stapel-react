/**
 * WHAT CHAT CAN BE LIVE ABOUT: the two stream keys, and where each one's
 * socket is mounted.
 *
 * This is the module-specific half of realtime — the only half a pair owns
 * once `@stapel/realtime` carries the protocol. Everything else (the
 * envelope, the resume, the heartbeat, the close-code table, the 4401 session
 * refresh) belongs to the substrate and is not restated here.
 *
 * The two streams, verbatim from `stapel_chat/realtime.py` and
 * `stapel_chat/routing.py` at the pinned 0.6.0 contract:
 *
 * | stream key | socket path | kind |
 * |---|---|---|
 * | `chat:conv:<conversation_id>` | `ws/chat/<conversation_id>` | journal — resumable by `rev_seq` |
 * | `chat:user:<user_id>` | `ws/chat/inbox` | ephemeral — nothing to resume |
 *
 * **The inbox route carries no user segment.** The consumer derives its
 * stream key from the authenticated scope (`ChatInboxConsumer.get_stream_key`
 * → `user_stream(self._user_id())`), so there is nothing in the URL to tamper
 * with — and the key the SERVER stamps on every frame is
 * `chat:user:<the signed-in user>`. A client that subscribes under any other
 * key gets a socket that delivers nothing, because the substrate routes on
 * `envelope.stream`. That is why {@link chatInboxStream} takes the id instead
 * of guessing it, exactly as `@stapel/notifications-react`'s inbox does.
 */
import type { Conversation } from "../api/types.js";

/** Stream-key module segment (`stapel_chat.realtime.STREAM_MODULE`). */
export const CHAT_STREAM_MODULE = "chat";

/** The inbox mount — one path for every user (`routing.py`). */
export const CHAT_INBOX_SOCKET_PATH = "ws/chat/inbox";

/** `chat:conv:<id>` — the resumable journal of one conversation. */
export function chatConversationStreamKey(conversationId: string): string {
  return `${CHAT_STREAM_MODULE}:conv:${conversationId}`;
}

/** `chat:user:<id>` — one participant's ephemeral inbox stream. */
export function chatUserStreamKey(userId: string): string {
  return `${CHAT_STREAM_MODULE}:user:${userId}`;
}

/** `ws/chat/<id>` — where one conversation's socket is mounted. */
export function chatConversationSocketPath(conversationId: string): string {
  return `ws/chat/${encodeURIComponent(conversationId)}`;
}

/**
 * One thing a chat surface can subscribe to: the key the server stamps on
 * every frame, the path its socket is mounted at, and whether it has a
 * journal to resume.
 *
 * `journal: false` is not a detail — it is why the inbox never sends a resume
 * cursor and never advances one. An ephemeral stream's welcome is
 * `{ephemeral: true}` and nothing it carries is owed to a client that was
 * away; the conversation list re-reads over REST instead.
 */
export interface ChatStream {
  readonly kind: "conversation" | "inbox";
  /** `envelope.stream` — what the substrate routes on. */
  readonly key: string;
  /** Mount path, relative to the socket origin. No leading slash. */
  readonly path: string;
  /** Resumable (`chat:conv:*`) vs ephemeral (`chat:user:*`). */
  readonly journal: boolean;
  /** Set for a conversation stream — the id the thread queries are keyed by. */
  readonly conversationId: string | undefined;
}

/**
 * The stream for one conversation.
 *
 * `overrides` is how the SERVER's own answer wins over anything derived here:
 * `ConversationResponse` carries `stream_key` and `socket_path`, and a client
 * that recomputes them is a second, staler answer to a question the row
 * already answers. See {@link chatStreamForConversation}.
 */
export function chatConversationStream(
  conversationId: string,
  overrides?: {
    readonly streamKey?: string | undefined;
    readonly socketPath?: string | undefined;
  }
): ChatStream {
  return {
    kind: "conversation",
    key: overrides?.streamKey ?? chatConversationStreamKey(conversationId),
    path: overrides?.socketPath ?? chatConversationSocketPath(conversationId),
    journal: true,
    conversationId,
  };
}

/**
 * The stream for a conversation ROW.
 *
 * `stream_key` and `socket_path` are populated by the server on every
 * conversation it serves — but they are absent from the schema's `required`
 * list, so the generated type makes both optional and TypeScript is right to
 * insist. The fallback below is therefore for an absence the pinned server
 * never produces (and for a 0.3.x host that predates the fields), not for a
 * shape anyone should design against. Reported upstream; nothing here depends
 * on it being fixed.
 */
export function chatStreamForConversation(conversation: Conversation): ChatStream {
  return chatConversationStream(conversation.id, {
    streamKey: conversation.stream_key,
    socketPath: conversation.socket_path,
  });
}

/** The signed-in user's inbox stream. */
export function chatInboxStream(userId: string): ChatStream {
  return {
    kind: "inbox",
    key: chatUserStreamKey(userId),
    path: CHAT_INBOX_SOCKET_PATH,
    journal: false,
    conversationId: undefined,
  };
}

/**
 * Derive the socket ORIGIN from the REST base URL: `wss://host`, no path.
 *
 * The path is the stream's (`ws/chat/<id>`, `ws/chat/inbox`) and the mounts
 * sit at the host root, not under the module's API prefix — the fleet
 * convention `/ws/<mod>/…`, and `stapel_chat.routing` verbatim.
 *
 * `null` means "this build cannot resolve a socket origin" (a relative
 * `baseUrl` with no `origin`: SSR, a node test). It is not a failure — it is
 * a fact the transport seam NAMES rather than swallows.
 */
export function deriveChatSocketOrigin(
  baseUrl: string,
  origin?: string | null
): string | null {
  try {
    const url = new URL(baseUrl, origin ?? undefined);
    const protocol =
      url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** The socket URL for a stream, or `null` when this build has no origin. */
export function chatSocketUrl(origin: string | null, stream: ChatStream): string | null {
  if (origin === null) return null;
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const path = stream.path.startsWith("/") ? stream.path.slice(1) : stream.path;
  return `${base}/${path}`;
}

/**
 * The URL for a raw stream KEY — the resolver `<ChatProvider>` hands the
 * substrate, so a host that subscribes to `chat:conv:<id>` with its own
 * `useStream` reaches the same socket the pair would.
 *
 * `null` for a key this module does not own; the pair's own surfaces pass the
 * URL explicitly (a conversation row carries its `socket_path`), so this is
 * the fallback, not the main path.
 */
export function chatSocketUrlForStreamKey(
  origin: string | null,
  streamKey: string
): string | null {
  const [module, scope, ...rest] = streamKey.split(":");
  const id = rest.join(":");
  if (module !== CHAT_STREAM_MODULE || id === "") return null;
  if (scope === "conv") return chatSocketUrl(origin, chatConversationStream(id));
  if (scope === "user") return chatSocketUrl(origin, chatInboxStream(id));
  return null;
}
