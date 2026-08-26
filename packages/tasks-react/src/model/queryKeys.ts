/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "keys are namespaced").
 * Everything under the `"tasks"` root so a host can invalidate the whole
 * module or match a single resource. Explicit tuple return types satisfy
 * `--isolatedDeclarations`.
 *
 * `cards(boardId, filtersKey)` carries the SERVER-side filters only. The text
 * filter is applied in the client (the backend has no card search), so putting
 * it in the key would refetch the whole board on every keystroke and answer
 * with the same bytes.
 */
import type { BoardCardsFilters } from "../api/tasksApi.js";

const ROOT = "tasks" as const;

/** A stable, order-independent string for the server-side board filters. */
export function filtersKey(filters?: BoardCardsFilters): string {
  if (filters === undefined) return "";
  const parts: string[] = [];
  if (filters.column !== undefined) parts.push(`column=${filters.column}`);
  if (filters.category !== undefined) parts.push(`category=${filters.category}`);
  if (filters.assigneeId !== undefined)
    parts.push(`assignee=${filters.assigneeId}`);
  if (filters.includeArchived === true) parts.push("archived=1");
  return parts.sort().join("&");
}

export const tasksQueryKeys: {
  readonly all: readonly ["tasks"];
  readonly boards: readonly ["tasks", "boards"];
  readonly presets: readonly ["tasks", "presets"];
  board: (boardId: string) => readonly ["tasks", "board", string];
  columns: (boardId: string) => readonly ["tasks", "columns", string];
  cards: (
    boardId: string,
    filters?: BoardCardsFilters
  ) => readonly ["tasks", "cards", string, string];
  /** Every filter combination of one board's card read — the prefix a card
   * write invalidates, because a new card belongs to filtered views too. */
  cardsPrefix: (boardId: string) => readonly ["tasks", "cards", string];
  feed: (
    boardId: string,
    filters?: BoardCardsFilters
  ) => readonly ["tasks", "feed", string, string];
  task: (taskId: string) => readonly ["tasks", "task", string];
  comments: (taskId: string) => readonly ["tasks", "comments", string];
  checklist: (taskId: string) => readonly ["tasks", "checklist", string];
} = {
  all: [ROOT],
  boards: [ROOT, "boards"],
  presets: [ROOT, "presets"],
  board: (boardId) => [ROOT, "board", boardId],
  columns: (boardId) => [ROOT, "columns", boardId],
  cards: (boardId, filters) => [ROOT, "cards", boardId, filtersKey(filters)],
  cardsPrefix: (boardId) => [ROOT, "cards", boardId],
  feed: (boardId, filters) => [ROOT, "feed", boardId, filtersKey(filters)],
  task: (taskId) => [ROOT, "task", taskId],
  comments: (taskId) => [ROOT, "comments", taskId],
  checklist: (taskId) => [ROOT, "checklist", taskId],
};
