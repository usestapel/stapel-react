/**
 * Wire bodies, verbatim in shape from stapel-chat's serializers — the pages
 * these tests drive through the real transport.
 */
import type {
  ChatMessage,
  Conversation,
  ConversationPage,
  MessagePage,
} from "../src/index.js";

export const CONVERSATION_ID = "8f14e45f-ceea-467a-9b58-2f0b0b1a6b21";
export const BUYER = "u-buyer";
export const SELLER = "u-seller";

export function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: CONVERSATION_ID,
    kind: "direct",
    scope_key: "global",
    support_status: "",
    // Populated by the server on every conversation it serves — and absent
    // from the schema's `required` list, which is the upstream note in
    // MODULE.md. The pair reads them when they are there and derives when
    // they are not.
    stream_key: `chat:conv:${CONVERSATION_ID}`,
    socket_path: `ws/chat/${CONVERSATION_ID}`,
    last_seq: 3,
    unread_count: 2,
    created_at: "2026-08-20T09:00:00Z",
    updated_at: "2026-08-21T18:12:00Z",
    participants: [
      { user_id: BUYER, role: "member", last_read_seq: 1 },
      { user_id: SELLER, role: "member", last_read_seq: 3 },
    ],
    ...overrides,
  };
}

export function conversationPage(
  items: readonly Conversation[] = [conversation()],
  overrides: Partial<ConversationPage> = {}
): ConversationPage {
  return {
    items: [...items],
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: items.length,
    ...overrides,
  };
}

export function message(seq: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m-${seq}`,
    conversation_id: CONVERSATION_ID,
    seq,
    // `rev_seq` is required since 0.6.0 and is the RESUME CURSOR — the number
    // `hello{last_seq}` carries. A fresh message has rev_seq === seq; an edit
    // keeps its seq and takes a new rev_seq, which is why the two are separate
    // fields here rather than one reused number.
    rev_seq: seq,
    kind: "text",
    body: `message ${seq}`,
    created_at: "2026-08-21T18:00:00Z",
    sender_id: BUYER,
    reply_to: null,
    attachments: [],
    ...overrides,
  };
}

/**
 * A history page. Item ORDER matters and differs by direction: core's
 * `AnchorPagination` returns newest-first for `next` (and for an unanchored
 * read) and oldest-first for `prev`. These fixtures reproduce that rather
 * than normalizing it, because reproducing it is what proves the pair does
 * not depend on the order.
 */
export function messagePage(
  seqs: readonly number[],
  options: {
    readonly direction?: "next" | "prev";
    readonly has_next?: boolean;
    readonly has_prev?: boolean;
    readonly next_anchor?: string | null;
  } = {}
): MessagePage {
  const direction = options.direction ?? "next";
  const ordered = [...seqs].sort((a, b) => (direction === "prev" ? a - b : b - a));
  return {
    items: ordered.map((seq) => message(seq)),
    next_anchor: options.next_anchor ?? null,
    prev_anchor: null,
    has_next: options.has_next ?? false,
    has_prev: options.has_prev ?? false,
    count: ordered.length,
  };
}

/** The real refusal envelope stapel backends send (no `.status` on it). */
export function errorEnvelope(code: string): { localizable_error: string } {
  return { localizable_error: code };
}
