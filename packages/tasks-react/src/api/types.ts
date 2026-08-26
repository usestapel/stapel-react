/**
 * Wire types for the stapel-tasks HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-tasks's OWN `docs/schema.json`).
 *
 * stapel-tasks 0.3.0 is the release that made this possible: before it the
 * module emitted no schema at all and drf-spectacular's graceful fallback
 * described thirteen endpoints with no bodies, so a pair had to hand-write its
 * DTOs from `dto.py`. Every alias below is a rename, not a redefinition — if a
 * field disappears upstream, the alias stops compiling here rather than
 * silently rendering `undefined` on a card.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── reads ────────────────────────────────────────────────────────────────────

/** A board with its columns (`GET boards`, `GET boards/{id}`). */
export type Board = Schemas["BoardResponse"];

/** One column of a board. `key` is also a card's status. */
export type Column = Schemas["ColumnResponse"];

/** A card. `position` is a stringified Decimal — compare it, never `Number()`
 * it (see `model/board.ts`). */
export type Task = Schemas["TaskResponse"];

/**
 * The board-shaped read (`GET boards/{id}/cards`, backend 0.3.0): columns in
 * order, cards grouped by column key and sorted by `position`, un-paginated,
 * `truncated` when the server's cap cut the answer short.
 */
export type BoardCards = Schemas["BoardCardsResponse"];

/** One keyset page of the `-created_at` card FEED (`GET boards/{id}/tasks`).
 * A feed, not a board — the kanban screen reads {@link BoardCards}. */
export type TaskPage = Schemas["TaskPageResponse"];

export type Comment = Schemas["CommentResponse"];
export type ChecklistItem = Schemas["ChecklistItemResponse"];

/** The outcome of a move — `applied` (200), `deferred` (202) or `denied` (409). */
export type MoveResponse = Schemas["MoveResponse"];

/** Everything a board-creation form needs that is otherwise undiscoverable. */
export type BoardVocabulary = Schemas["BoardVocabularyResponse"];
export type BoardPreset = Schemas["BoardPresetResponse"];
export type PresetColumn = Schemas["PresetColumnResponse"];
export type PriorityLevel = Schemas["PriorityLevelResponse"];
export type VocabularyTerm = Schemas["VocabularyTermResponse"];

/** `{ status: "archived" }` — both archive endpoints answer this. */
export type ArchivedResponse = Schemas["ArchivedResponse"];

// ── writes ───────────────────────────────────────────────────────────────────

export type BoardCreateBody = Schemas["BoardCreateRequest"];
export type BoardUpdateBody = Schemas["PatchedBoardUpdateRequest"];
export type ColumnCreateBody = Schemas["ColumnCreateRequest"];
export type ColumnReorderBody = Schemas["ColumnReorderRequest"];
export type TaskCreateBody = Schemas["TaskCreateRequest"];
export type TaskUpdateBody = Schemas["PatchedTaskUpdateRequest"];
export type TaskMoveBody = Schemas["TaskMoveRequest"];
export type TaskAssignBody = Schemas["TaskAssignRequest"];
export type CommentCreateBody = Schemas["CommentCreateRequest"];
export type ChecklistItemCreateBody = Schemas["ChecklistItemCreateRequest"];
export type ChecklistItemStateBody = Schemas["ChecklistItemStateRequest"];

/**
 * `BoardCreateRequest.columns` is `{[k: string]: unknown}[]` in the emitted
 * schema — drf-spectacular cannot see inside the `ListField(child=DictField())`
 * the serializer declares. This is the shape `_column_specs()` actually reads
 * (`views.py`), spelled once so the create sheet is not writing untyped dicts.
 */
export interface BoardCreateColumnSpec {
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly name_key?: string;
  readonly wip_limit?: number | null;
}
