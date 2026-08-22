/**
 * How this pair NAMES the things it can be fresh about (realtime spec §7,
 * "how a pair declares its channels"): typed stream keys plus the one rule
 * that turns a key into a socket URL. Everything that decides *whether* a stream
 * has a socket at all lives here, so the transport seam above can stay a
 * two-line question.
 */

/** A conversation's own journal — the module mounts a socket per thread. */
export interface ChatConversationStream {
  readonly kind: "conversation";
  readonly conversationId: string;
}

/**
 * The caller's inbox (their conversation list).
 *
 * There is NO socket for this one, and that is a fact about the backend, not
 * a gap in this pair: `stapel_chat.routing` mounts exactly one pattern,
 * `ws/chat/<uuid:conversation_id>`, and the Channels group a message fans out
 * to is `chat.conv.<id>` — per thread. Nothing broadcasts "your list moved".
 * So the inbox is kept fresh by the polling half of the seam, and the seam is
 * the reason no screen has to know that.
 */
export interface ChatInboxStream {
  readonly kind: "inbox";
}

export type ChatStreamKey = ChatConversationStream | ChatInboxStream;

export function chatConversationStream(
  conversationId: string
): ChatConversationStream {
  return { kind: "conversation", conversationId };
}

export function chatInboxStream(): ChatInboxStream {
  return { kind: "inbox" };
}

/** A stable string for a stream key — a React dependency, a log line. */
export function chatStreamId(stream: ChatStreamKey): string {
  return stream.kind === "conversation"
    ? `conversation:${stream.conversationId}`
    : "inbox";
}

/**
 * Derive the socket base from the REST base URL.
 *
 * The mount point is canonical (`stapel_chat/routing.py`, and the fleet
 * convention `/ws/<mod>/...` from the realtime spec §8): the sockets sit at
 * the HOST ROOT, not under the module's API prefix, so only the origin of
 * `baseUrl` is used. `http` → `ws`, `https` → `wss`.
 *
 * Returns `null` when no origin can be resolved — a relative `baseUrl` with
 * no `origin` (server-side rendering, a node test). `null` is not a failure:
 * it means "this build cannot open a socket", and the transport seam polls.
 */
export function deriveChatSocketBase(
  baseUrl: string,
  origin?: string | null
): string | null {
  try {
    const url = new URL(baseUrl, origin ?? undefined);
    const protocol =
      url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}/ws/chat/`;
  } catch {
    return null;
  }
}

/**
 * The socket URL for a stream, or `null` when the stream has none (the
 * inbox) or no base could be derived.
 */
export function chatSocketUrl(
  base: string | null,
  stream: ChatStreamKey
): string | null {
  if (base === null || stream.kind !== "conversation") return null;
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${encodeURIComponent(stream.conversationId)}`;
}
