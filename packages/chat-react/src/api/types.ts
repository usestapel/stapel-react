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

/** Query for `GET /conversations` (anchored on `updated_at`). */
export interface ConversationListParams {
  /** Anchor value to paginate from (exclusive) — a page's `next_anchor`. */
  readonly anchor?: string;
  readonly direction?: AnchorDirection;
  readonly limit?: number;
}

/** Query for `GET /conversations/{id}/messages` (anchored on `seq`). */
export interface MessageHistoryParams {
  /** A `seq` value, as a string — the anchor is exclusive. */
  readonly anchor?: string;
  readonly direction?: AnchorDirection;
  readonly limit?: number;
}
