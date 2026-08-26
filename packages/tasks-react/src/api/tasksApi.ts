import type { StapelClient } from "@stapel/core";
import { deniedMove } from "./extensions.js";
import type { ChecklistState } from "./enums.js";
import type {
  ArchivedResponse,
  Board,
  BoardCards,
  BoardCreateBody,
  BoardUpdateBody,
  BoardVocabulary,
  ChecklistItem,
  ChecklistItemCreateBody,
  Column,
  ColumnCreateBody,
  Comment,
  CommentCreateBody,
  MoveResponse,
  Task,
  TaskCreateBody,
  TaskPage,
  TaskUpdateBody,
} from "./types.js";

/**
 * The pair's typed operation surface, bound to the injected {@link StapelClient}
 * (the per-module override seam of frontend-standard §7.2). Paths are relative
 * to the runtime's `baseUrl` (`/tasks/api/v1/`).
 *
 * ── NO TRAILING SLASHES, ANYWHERE ─────────────────────────────────────────
 *
 * `urls_v1.py` registers all thirteen routes WITHOUT one (`boards`,
 * `boards/<uuid>/cards`, `tasks/<uuid>/move`, …). Django's `APPEND_SLASH` only
 * rescues a GET, and only with a redirect that drops the body — so a POST to
 * `boards/` would be a 404 rather than a board. `test/pair.test.ts` pins every
 * path string against the generated manifest's operation table, so a backend
 * that moves a route reddens a test here instead of a screen in production.
 *
 * All twenty-two operations of the contract are here; none is omitted.
 */
export interface TasksApi {
  readonly client: StapelClient;

  // ── boards ───────────────────────────────────────────────────────────────

  /** Boards in scope, non-archived. A bare array — no envelope, no paging. */
  boards(options?: RequestExtras): Promise<readonly Board[]>;

  /**
   * Presets, column categories, checklist states and the deployment's priority
   * scale. Everything a create form needs that a client cannot otherwise
   * discover: presets are an open merge registry and `priority` is an
   * unconstrained int in the table.
   */
  presets(options?: RequestExtras): Promise<BoardVocabulary>;

  createBoard(body: BoardCreateBody): Promise<Board>;

  board(boardId: string, options?: RequestExtras): Promise<Board>;

  updateBoard(boardId: string, body: BoardUpdateBody): Promise<Board>;

  /** Soft-delete. Answers `{status:"archived"}` — the rows are kept. */
  archiveBoard(boardId: string): Promise<ArchivedResponse>;

  // ── columns ──────────────────────────────────────────────────────────────

  columns(boardId: string, options?: RequestExtras): Promise<readonly Column[]>;

  /** 409 `error.409.tasks_column_exists` when the board already has the key. */
  addColumn(boardId: string, body: ColumnCreateBody): Promise<Column>;

  reorderColumns(
    boardId: string,
    keys: readonly string[]
  ): Promise<readonly Column[]>;

  // ── the board itself ─────────────────────────────────────────────────────

  /**
   * The whole board in one read (backend 0.3.0): columns in `order`, cards
   * grouped by column key and each group sorted by `position`. Un-paginated,
   * capped by the server's `BOARD_CARDS_MAX` with a `truncated` flag — which
   * is why this is the kanban screen's read and {@link TasksApi.tasks} is not.
   */
  boardCards(
    boardId: string,
    filters?: BoardCardsFilters,
    options?: RequestExtras
  ): Promise<BoardCards>;

  /**
   * One keyset page of the card FEED, ordered `-created_at`. Kept because it
   * is the only read that can walk a board bigger than the cap, and because a
   * host may want a "recently created" list; the board screen does not use it.
   */
  tasks(
    boardId: string,
    params?: TaskFeedParams,
    options?: RequestExtras
  ): Promise<TaskPage>;

  // ── cards ────────────────────────────────────────────────────────────────

  createTask(boardId: string, body: TaskCreateBody): Promise<Task>;

  task(taskId: string, options?: RequestExtras): Promise<Task>;

  updateTask(taskId: string, body: TaskUpdateBody): Promise<Task>;

  archiveTask(taskId: string): Promise<ArchivedResponse>;

  /**
   * Move a card. Answers `applied` / `deferred` / `denied` — the denial comes
   * back as a value, not as a throw (`api/extensions.ts` explains why the 409
   * has to be unwrapped here).
   */
  moveTask(
    taskId: string,
    toColumn: string,
    index?: number
  ): Promise<MoveResponse>;

  /** Replace the assignee set. A full replace, not a delta. */
  assign(taskId: string, assigneeIds: readonly string[]): Promise<Task>;

  // ── comments & checklist ─────────────────────────────────────────────────

  comments(taskId: string, options?: RequestExtras): Promise<readonly Comment[]>;

  addComment(taskId: string, body: CommentCreateBody): Promise<Comment>;

  checklist(
    taskId: string,
    options?: RequestExtras
  ): Promise<readonly ChecklistItem[]>;

  addChecklistItem(
    taskId: string,
    body: ChecklistItemCreateBody
  ): Promise<ChecklistItem>;

  setChecklistState(
    taskId: string,
    itemId: string,
    state: ChecklistState
  ): Promise<ChecklistItem>;
}

/** Per-call extras every read accepts (TanStack hands the query's signal in). */
export interface RequestExtras {
  readonly signal?: AbortSignal;
}

/** Server-side filters of the board read. `text` is NOT here — the backend
 * has no card search, so the pair filters titles in the client. */
export interface BoardCardsFilters {
  readonly column?: string;
  readonly category?: string;
  readonly assigneeId?: string;
  readonly includeArchived?: boolean;
}

/** Keyset parameters of the `-created_at` card feed. */
export interface TaskFeedParams extends BoardCardsFilters {
  readonly anchor?: string;
  readonly limit?: number;
  readonly direction?: "next" | "prev";
}

function readOptions(options?: RequestExtras): { signal?: AbortSignal } {
  return options?.signal !== undefined ? { signal: options.signal } : {};
}

function cardsQuery(
  filters?: BoardCardsFilters
): Record<string, string | boolean> {
  const query: Record<string, string | boolean> = {};
  if (filters?.column !== undefined) query["column"] = filters.column;
  if (filters?.category !== undefined) query["category"] = filters.category;
  if (filters?.assigneeId !== undefined) query["assignee_id"] = filters.assigneeId;
  if (filters?.includeArchived === true) query["include_archived"] = true;
  return query;
}

export function createTasksApi(client: StapelClient): TasksApi {
  return {
    client,

    boards: (options) =>
      client.get<readonly Board[]>("boards", readOptions(options)),

    presets: (options) =>
      client.get<BoardVocabulary>("boards/presets", readOptions(options)),

    createBoard: (body) => client.post<Board>("boards", body),

    board: (boardId, options) =>
      client.get<Board>(`boards/${boardId}`, readOptions(options)),

    updateBoard: (boardId, body) =>
      client.patch<Board>(`boards/${boardId}`, body),

    archiveBoard: (boardId) =>
      client.delete<ArchivedResponse>(`boards/${boardId}`),

    columns: (boardId, options) =>
      client.get<readonly Column[]>(
        `boards/${boardId}/columns`,
        readOptions(options)
      ),

    addColumn: (boardId, body) =>
      client.post<Column>(`boards/${boardId}/columns`, body),

    reorderColumns: (boardId, keys) =>
      client.post<readonly Column[]>(`boards/${boardId}/columns/reorder`, {
        keys: [...keys],
      }),

    boardCards: (boardId, filters, options) =>
      client.get<BoardCards>(`boards/${boardId}/cards`, {
        query: cardsQuery(filters),
        ...readOptions(options),
      }),

    tasks: (boardId, params, options) =>
      client.get<TaskPage>(`boards/${boardId}/tasks`, {
        query: {
          ...cardsQuery(params),
          ...(params?.anchor !== undefined ? { anchor: params.anchor } : {}),
          ...(params?.limit !== undefined ? { limit: params.limit } : {}),
          ...(params?.direction !== undefined
            ? { direction: params.direction }
            : {}),
        },
        ...readOptions(options),
      }),

    createTask: (boardId, body) =>
      client.post<Task>(`boards/${boardId}/tasks`, body),

    task: (taskId, options) =>
      client.get<Task>(`tasks/${taskId}`, readOptions(options)),

    updateTask: (taskId, body) => client.patch<Task>(`tasks/${taskId}`, body),

    archiveTask: (taskId) =>
      client.delete<ArchivedResponse>(`tasks/${taskId}`),

    moveTask: async (taskId, toColumn, index) => {
      try {
        return await client.post<MoveResponse>(`tasks/${taskId}/move`, {
          to_column: toColumn,
          ...(index !== undefined ? { index } : {}),
        });
      } catch (thrown) {
        const denied = deniedMove(thrown);
        if (denied !== null) return denied;
        throw thrown;
      }
    },

    assign: (taskId, assigneeIds) =>
      client.post<Task>(`tasks/${taskId}/assign`, {
        assignee_ids: [...assigneeIds],
      }),

    comments: (taskId, options) =>
      client.get<readonly Comment[]>(
        `tasks/${taskId}/comments`,
        readOptions(options)
      ),

    addComment: (taskId, body) =>
      client.post<Comment>(`tasks/${taskId}/comments`, body),

    checklist: (taskId, options) =>
      client.get<readonly ChecklistItem[]>(
        `tasks/${taskId}/checklist`,
        readOptions(options)
      ),

    addChecklistItem: (taskId, body) =>
      client.post<ChecklistItem>(`tasks/${taskId}/checklist`, body),

    setChecklistState: (taskId, itemId, state) =>
      client.post<ChecklistItem>(
        `tasks/${taskId}/checklist/${itemId}/state`,
        { state }
      ),
  };
}
