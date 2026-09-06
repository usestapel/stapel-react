/**
 * Wire types for the stapel-chat HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-chat's OWN `docs/schema.json`). Alias the schemas
 * this pair uses under local names here; do NOT write parallel response
 * bodies. Where drf-spectacular + openapi-typescript under-describe the
 * runtime, apply a small documented correction (below).
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── aliases (the stapel-chat schemas this pair uses) ─────────────────────────

/** A conversation (thread) as the list/detail endpoints return it. */
export type Conversation = Schemas["ConversationResponse"];
/** One participant of a conversation (role + read marker). */
export type Participant = Schemas["ParticipantResponse"];
/** A single message. `seq` is the total order — never sort by `created_at`. */
export type ChatMessage = Schemas["MessageResponse"];
/**
 * THE LINE AN INBOX ROW DRAWS — a projection, not a message (stapel-chat
 * 0.8.3).
 *
 * It carries exactly what paints a row (`seq`, `kind`, `sender_id`,
 * `created_at`, `body_preview`) and deliberately not enough to stand in for
 * the thread: no id, no attachments, no `rev_seq`. A client that wants those
 * opens the conversation. It is annotated for a whole page inside the query
 * the list already runs, which is why a row no longer costs a
 * `GET /messages?limit=1` of its own.
 *
 * `body_preview` is what the row DRAWS, already flattened to one line and
 * capped at 140 characters upstream — never a body to re-derive a preview
 * from. It is `null` in three cases, and since stapel-chat 0.8.4
 * `preview_reason` says WHICH (see {@link LastMessagePreviewReason} and
 * `model/previews.ts`).
 */
export type LastMessage = Schemas["LastMessageResponse"];
/** POST /conversations request body. */
export type CreateConversationRequest = Schemas["CreateConversationRequest"];
/** POST /conversations/{id}/messages request body. */
export type SendMessageRequest = Schemas["SendMessageRequest"];
/** POST /conversations/{id}/read request body. */
export type MarkReadRequest = Schemas["MarkReadRequest"];
/** GET /conversations 200 body — anchor-paginated on `updated_at`. */
export type ConversationPage = Schemas["PaginatedConversationResponseList"];
/** GET /conversations/{id}/messages 200 body — anchor-paginated on `seq`. */
export type MessagePage = Schemas["PaginatedMessageResponseList"];
/**
 * What a conversation is ABOUT, with the card its owner rendered.
 *
 * `card` is `unknown`-shaped on purpose, on both sides of the wire:
 * stapel-chat stores an opaque `(type, key)` and calls the type's registered
 * `card_function` for the rest, never looking inside the answer. Neither does
 * this pair — the default skin reads the conventional fields and a host with
 * a different card replaces the renderer (`model/slots.ts`).
 */
export type Subject = Schemas["SubjectResponse"];
/** A render descriptor for one attached/illustrated file (CDN geometry). */
export type Attachment = Schemas["AttachmentResponse"];

/**
 * The half of a subject a CLIENT supplies: the name, never the card. Both
 * fields or neither — stapel-chat answers `error.400.chat_incomplete_subject`
 * for half a pair.
 */
export interface SubjectRef {
  readonly type: string;
  readonly key: string;
}

// ── documented corrections (drf-spectacular under-describes) ─────────────────

/**
 * Conversation kind. The generated schema types `kind` as a bare `string`; the
 * backend constrains it to these three (`models.ConversationKind`, and
 * `CHAT_KINDS` may narrow it further per deployment — a kind that is disabled
 * answers `error.400.chat_kind_disabled` rather than disappearing from the
 * type).
 */
export type ConversationKind = "direct" | "group" | "support";

/**
 * Message kind. `system` lines are authored by nobody (`sender_id: null`) and
 * never raise an unread badge (`services.unread_count`) — a distinction the
 * bare `string` in the schema cannot make and a renderer must.
 */
export type MessageKind = "text" | "system";

/**
 * WHICH of the three `body_preview: null` cases an inbox row is in
 * (stapel-chat 0.8.4, `services.last_line_reason`).
 *
 * The generated schema types the field as a bare nullable `string` — the
 * server declares no enum — so the union lives here, at the pair's own edge,
 * exactly like {@link MessageKind} and {@link ConversationKind} above. `null`
 * (and, on a 0.8.3 server, absent) means the projection has words and the row
 * draws them.
 *
 * It exists because a client could not tell a tombstone from an attachment:
 * both arrived as one `null` with `kind: "text"` beside them, so the row said
 * "Attachment" over a deleted message — right for the common case, wrong for
 * the one where being wrong is a lie about somebody's words.
 */
export type LastMessagePreviewReason = "deleted" | "attachment" | "system";

/**
 * Support lifecycle. Empty string for non-support threads — the serializer
 * sends `""`, not `null`, which is why this union carries it explicitly
 * instead of pretending the field is optional.
 */
export type SupportStatus = "" | "open" | "pending" | "resolved";

/** A participant's role in the thread. */
export type ParticipantRole = "member" | "operator";

/**
 * Anchor-pagination direction (core `AnchorPagination`). For the message
 * history — ordered `-seq`, newest first — this reads:
 *
 *  - `next` (default): messages OLDER than the anchor (seq below it),
 *  - `prev`: messages NEWER than the anchor (seq above it) — the live tail,
 *  - `center`: a window around the anchor.
 */
export type AnchorDirection = "next" | "prev" | "center";

/**
 * Query for `GET /conversations` (anchored on `updated_at`).
 *
 * `search` and `unread` are the SERVER's filters (stapel-chat 0.8.2) and they
 * apply BEFORE the page is taken, so `anchor` / `direction` / `limit` mean
 * exactly what they mean without them: paging a search walks the filtered
 * list and can never surface a row the search excluded.
 */
export interface ConversationListParams {
  /** Anchor value to paginate from (exclusive) — a page's `next_anchor`. */
  readonly anchor?: string;
  readonly direction?: AnchorDirection;
  readonly limit?: number;
  /**
   * Case-insensitive substring over the three things a row DRAWS: the
   * counterpart's display name, the subject card's title, and the last
   * message's body — the very text `last_message.body_preview` ships, one
   * rule for both, so a row can never come back for a word nobody can see on
   * it. Blank or whitespace-only is no search at all (the server says so, and
   * this pair does not send one).
   */
  readonly search?: string;
  /**
   * `true` keeps only the conversations whose `unread_count` is above zero
   * for the caller — the same subquery the number on the row is produced
   * from, so the chip and the badge cannot disagree. Any other value is no
   * filter, so this pair sends the parameter only when it is `true`.
   */
  readonly unread?: boolean;
}

/** Query for `GET /conversations/{id}/messages` (anchored on `seq`). */
export interface MessageHistoryParams {
  /** A `seq` value, as a string — the anchor is exclusive. */
  readonly anchor?: string;
  readonly direction?: AnchorDirection;
  readonly limit?: number;
}
