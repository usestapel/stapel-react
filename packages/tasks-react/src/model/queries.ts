/**
 * The server-state layer: one hook per read, one per write, no UI decisions.
 *
 * ── One read for the board, not a drain ────────────────────────────────────
 *
 * The spec this pair was built from predates stapel-tasks 0.3.0 and told the
 * client to drain `GET boards/{id}/tasks` page by page and re-sort by
 * `position` — because the only card read was a `-created_at` FEED and there
 * was no whole-board endpoint to read instead. 0.3.0 shipped
 * `GET boards/{id}/cards`: columns in order, cards grouped by column key and
 * position-sorted, un-paginated, with `truncated` when the server's cap cut the
 * answer short. That is one request instead of N, one sort authority instead of
 * two, and — because `services.board_cards()` also backs the comm transport —
 * the same board answered the same way over both.
 *
 * ── Invalidation ──────────────────────────────────────────────────────────
 *
 * Every card write touches the BOARD, not only the card: creating, moving,
 * archiving and assigning all change what a column contains. So the card
 * mutations invalidate the `cards` prefix for the board as well as the
 * `task(id)` key, and never just the key they wrote through — which is how a
 * moved card stays in its old column until a reload.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  QueryClient,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  loadStateFromQuery,
  useActiveSessionReady,
} from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { ChecklistState } from "../api/enums.js";
import type { BoardCardsFilters } from "../api/tasksApi.js";
import type {
  ArchivedResponse,
  Board,
  BoardCards,
  BoardCreateBody,
  BoardUpdateBody,
  BoardVocabulary,
  ChecklistItem,
  Column,
  ColumnCreateBody,
  Comment,
  MoveResponse,
  Task,
  TaskCreateBody,
  TaskUpdateBody,
} from "../api/types.js";
import { useTasksApi } from "./context.js";
import { tasksQueryKeys } from "./queryKeys.js";

/** The vocabulary read changes only when a deployment reconfigures itself. */
const VOCABULARY_STALE_MS = 5 * 60_000;

// ── reads ───────────────────────────────────────────────────────────────────

/** Boards in scope. */
export function useBoardsQuery(): UseQueryResult<
  readonly Board[],
  StapelApiError
> {
  const api = useTasksApi();
  const sessionReady = useActiveSessionReady();
  return useQuery<readonly Board[], StapelApiError>({
    queryKey: tasksQueryKeys.boards,
    queryFn: ({ signal }) => api.boards({ signal }),
    enabled: sessionReady,
  });
}

/** Presets, categories, checklist states and the configured priority scale. */
export function useVocabularyQuery(): UseQueryResult<
  BoardVocabulary,
  StapelApiError
> {
  const api = useTasksApi();
  const sessionReady = useActiveSessionReady();
  return useQuery<BoardVocabulary, StapelApiError>({
    queryKey: tasksQueryKeys.presets,
    queryFn: ({ signal }) => api.presets({ signal }),
    staleTime: VOCABULARY_STALE_MS,
    enabled: sessionReady,
  });
}

export function useBoardQuery(
  boardId: string | undefined
): UseQueryResult<Board, StapelApiError> {
  const api = useTasksApi();
  const sessionReady = useActiveSessionReady();
  return useQuery<Board, StapelApiError>({
    queryKey: tasksQueryKeys.board(boardId ?? ""),
    queryFn: ({ signal }) => api.board(boardId ?? "", { signal }),
    enabled: sessionReady && boardId !== undefined && boardId !== "",
  });
}

/** The board-shaped card read — the kanban screen's only card request. */
export function useBoardCardsQuery(
  boardId: string | undefined,
  filters?: BoardCardsFilters
): UseQueryResult<BoardCards, StapelApiError> {
  const api = useTasksApi();
  const sessionReady = useActiveSessionReady();
  return useQuery<BoardCards, StapelApiError>({
    queryKey: tasksQueryKeys.cards(boardId ?? "", filters),
    queryFn: ({ signal }) => api.boardCards(boardId ?? "", filters, { signal }),
    enabled: sessionReady && boardId !== undefined && boardId !== "",
  });
}

export function useTaskQuery(
  taskId: string | undefined
): UseQueryResult<Task, StapelApiError> {
  const api = useTasksApi();
  const sessionReady = useActiveSessionReady();
  return useQuery<Task, StapelApiError>({
    queryKey: tasksQueryKeys.task(taskId ?? ""),
    queryFn: ({ signal }) => api.task(taskId ?? "", { signal }),
    enabled: sessionReady && taskId !== undefined && taskId !== "",
  });
}

export function useCommentsQuery(
  taskId: string | undefined
): UseQueryResult<readonly Comment[], StapelApiError> {
  const api = useTasksApi();
  const sessionReady = useActiveSessionReady();
  return useQuery<readonly Comment[], StapelApiError>({
    queryKey: tasksQueryKeys.comments(taskId ?? ""),
    queryFn: ({ signal }) => api.comments(taskId ?? "", { signal }),
    enabled: sessionReady && taskId !== undefined && taskId !== "",
  });
}

export function useChecklistQuery(
  taskId: string | undefined
): UseQueryResult<readonly ChecklistItem[], StapelApiError> {
  const api = useTasksApi();
  const sessionReady = useActiveSessionReady();
  return useQuery<readonly ChecklistItem[], StapelApiError>({
    queryKey: tasksQueryKeys.checklist(taskId ?? ""),
    queryFn: ({ signal }) => api.checklist(taskId ?? "", { signal }),
    enabled: sessionReady && taskId !== undefined && taskId !== "",
  });
}

/** `LoadState` twin of a query — what every headless bag hands a skin. */
export function loadOf<T>(query: UseQueryResult<T, StapelApiError>): LoadState<T> {
  return loadStateFromQuery(query);
}

// ── writes ──────────────────────────────────────────────────────────────────

function invalidateBoards(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: tasksQueryKeys.boards });
}

/** Every read that describes a board's contents. Card writes hit all of it. */
function invalidateBoard(client: QueryClient, boardId: string): void {
  void client.invalidateQueries({ queryKey: tasksQueryKeys.board(boardId) });
  void client.invalidateQueries({ queryKey: tasksQueryKeys.cardsPrefix(boardId) });
  void client.invalidateQueries({ queryKey: tasksQueryKeys.columns(boardId) });
}

export function useCreateBoard(): UseMutationResult<
  Board,
  StapelApiError,
  BoardCreateBody
> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<Board, StapelApiError, BoardCreateBody>({
    mutationFn: (body) => api.createBoard(body),
    onSuccess: () => {
      invalidateBoards(client);
    },
  });
}

export function useUpdateBoard(
  boardId: string
): UseMutationResult<Board, StapelApiError, BoardUpdateBody> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<Board, StapelApiError, BoardUpdateBody>({
    mutationFn: (body) => api.updateBoard(boardId, body),
    onSuccess: () => {
      invalidateBoards(client);
      invalidateBoard(client, boardId);
    },
  });
}

export function useArchiveBoard(): UseMutationResult<
  ArchivedResponse,
  StapelApiError,
  string
> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<ArchivedResponse, StapelApiError, string>({
    mutationFn: (boardId) => api.archiveBoard(boardId),
    onSuccess: () => {
      invalidateBoards(client);
    },
  });
}

export function useAddColumn(
  boardId: string
): UseMutationResult<Column, StapelApiError, ColumnCreateBody> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<Column, StapelApiError, ColumnCreateBody>({
    mutationFn: (body) => api.addColumn(boardId, body),
    onSuccess: () => {
      invalidateBoard(client, boardId);
      invalidateBoards(client);
    },
  });
}

export function useReorderColumns(
  boardId: string
): UseMutationResult<readonly Column[], StapelApiError, readonly string[]> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<readonly Column[], StapelApiError, readonly string[]>({
    mutationFn: (keys) => api.reorderColumns(boardId, keys),
    onSuccess: () => {
      invalidateBoard(client, boardId);
      invalidateBoards(client);
    },
  });
}

export function useCreateTaskMutation(
  boardId: string
): UseMutationResult<Task, StapelApiError, TaskCreateBody> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<Task, StapelApiError, TaskCreateBody>({
    mutationFn: (body) => api.createTask(boardId, body),
    onSuccess: () => {
      invalidateBoard(client, boardId);
    },
  });
}

export function useUpdateTask(
  taskId: string,
  boardId?: string
): UseMutationResult<Task, StapelApiError, TaskUpdateBody> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<Task, StapelApiError, TaskUpdateBody>({
    mutationFn: (body) => api.updateTask(taskId, body),
    onSuccess: (task) => {
      client.setQueryData(tasksQueryKeys.task(taskId), task);
      invalidateBoard(client, boardId ?? task.board_id);
    },
  });
}

export function useArchiveTask(
  taskId: string,
  boardId?: string
): UseMutationResult<ArchivedResponse, StapelApiError, undefined> {
  const api = useTasksApi();
  const client = useQueryClient();
  // `undefined`, not `void`, as the variables type: the archive endpoint takes
  // no body, and `void` in a generic position is a type error under the
  // fleet's ruleset. Callers pass `undefined` explicitly.
  return useMutation<ArchivedResponse, StapelApiError, undefined>({
    mutationFn: () => api.archiveTask(taskId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: tasksQueryKeys.task(taskId) });
      if (boardId !== undefined) invalidateBoard(client, boardId);
    },
  });
}

export interface MoveVariables {
  readonly taskId: string;
  readonly toColumn: string;
  readonly index: number;
}

/**
 * The move call itself. Deliberately WITHOUT `onSuccess` cache surgery: the
 * optimistic placement and its rollback belong to `useBoard`, which owns the
 * assembled board map and the machine that decides whether an outcome keeps
 * the card where it was dropped.
 */
export function useMoveTask(): UseMutationResult<
  MoveResponse,
  StapelApiError,
  MoveVariables
> {
  const api = useTasksApi();
  return useMutation<MoveResponse, StapelApiError, MoveVariables>({
    mutationFn: (vars) => api.moveTask(vars.taskId, vars.toColumn, vars.index),
  });
}

export function useAssign(
  taskId: string,
  boardId?: string
): UseMutationResult<Task, StapelApiError, readonly string[]> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<Task, StapelApiError, readonly string[]>({
    mutationFn: (ids) => api.assign(taskId, ids),
    onSuccess: (task) => {
      client.setQueryData(tasksQueryKeys.task(taskId), task);
      invalidateBoard(client, boardId ?? task.board_id);
    },
  });
}

export function useAddComment(
  taskId: string
): UseMutationResult<Comment, StapelApiError, string> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<Comment, StapelApiError, string>({
    mutationFn: (body) => api.addComment(taskId, { body }),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: tasksQueryKeys.comments(taskId),
      });
    },
  });
}

export function useAddChecklistItem(
  taskId: string
): UseMutationResult<ChecklistItem, StapelApiError, string> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<ChecklistItem, StapelApiError, string>({
    mutationFn: (text) => api.addChecklistItem(taskId, { text }),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: tasksQueryKeys.checklist(taskId),
      });
      void client.invalidateQueries({ queryKey: tasksQueryKeys.task(taskId) });
    },
  });
}

export interface ChecklistStateVariables {
  readonly itemId: string;
  readonly state: ChecklistState;
}

export function useSetChecklistState(
  taskId: string
): UseMutationResult<ChecklistItem, StapelApiError, ChecklistStateVariables> {
  const api = useTasksApi();
  const client = useQueryClient();
  return useMutation<ChecklistItem, StapelApiError, ChecklistStateVariables>({
    mutationFn: (vars) =>
      api.setChecklistState(taskId, vars.itemId, vars.state),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: tasksQueryKeys.checklist(taskId),
      });
      void client.invalidateQueries({ queryKey: tasksQueryKeys.task(taskId) });
    },
  });
}
