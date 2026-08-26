/**
 * The boards list, headless.
 *
 * `create` is an {@link ActionAvailability} rather than a boolean because the
 * one thing that can stop a person creating a board is not a permission the
 * client can see — it is `error.503.tasks_scope_unresolved`, the deployment
 * saying it cannot work out which workspace the board would belong to. That
 * arrives from the SERVER, on the POST, so the gate here covers only what is
 * knowable before the call (the list is still loading / failed) and the 503 is
 * surfaced as the create sheet's stated refusal.
 */
import { useCallback } from "react";
import {
  actionAvailable,
  loadStateFromQuery,
  requireLoaded,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import { TASKS_EVENTS } from "../analytics/events.js";
import type { Board, BoardCreateBody } from "../api/types.js";
import { useTasksAnalytics } from "../model/context.js";
import {
  useArchiveBoard,
  useBoardsQuery,
  useCreateBoard,
} from "../model/queries.js";

export interface BoardsBag {
  readonly boards: LoadState<readonly Board[]>;
  /** Blocked while the list is loading or failed — a create sheet opened over
   * a screen that could not load is a form nobody can trust. */
  readonly create: ActionAvailability;
  /** Run the create. Resolves with the new board so a caller can navigate. */
  readonly runCreate: (body: BoardCreateBody) => Promise<Board>;
  readonly creating: boolean;
  readonly createError: unknown;
  readonly archive: (boardId: string) => Promise<void>;
  readonly archiving: boolean;
  readonly archiveError: unknown;
  readonly refetch: () => void;
}

export function useBoards(): BoardsBag {
  const query = useBoardsQuery();
  const analytics = useTasksAnalytics();
  const createMutation = useCreateBoard();
  const archiveMutation = useArchiveBoard();
  const boards = loadStateFromQuery(query);

  const runCreate = useCallback(
    async (body: BoardCreateBody): Promise<Board> => {
      const board = await createMutation.mutateAsync(body);
      analytics?.track(TASKS_EVENTS.boardCreated, {
        preset: body.preset ?? "simple",
      });
      return board;
    },
    [analytics, createMutation]
  );

  const archive = useCallback(
    async (boardId: string): Promise<void> => {
      await archiveMutation.mutateAsync(boardId);
    },
    [archiveMutation]
  );

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    boards,
    create: requireLoaded(boards, () => actionAvailable()),
    runCreate,
    creating: createMutation.isPending,
    createError: createMutation.error,
    archive,
    archiving: archiveMutation.isPending,
    archiveError: archiveMutation.error,
    refetch,
  };
}
