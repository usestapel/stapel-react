/**
 * The board, headless — the bag the kanban skin is a rendering of.
 *
 * ── The optimistic move, and how it un-does itself ────────────────────────
 *
 * A drag that waited for a round trip before the card moved would feel broken,
 * so the card moves immediately: {@link applyMove} produces a new
 * {@link BoardMap} and it is held as an OVERLAY over the query's own assembled
 * map. The overlay is keyed by the query payload it was computed from
 * (`overlay.base === query.data`), which is what makes the expiry mechanical:
 * the moment a refetch delivers a new payload the overlay stops applying, with
 * no effect to run and nothing to remember to clear.
 *
 * The four outcomes are not four ways of saying "done":
 *
 *   applied  — keep the placement, invalidate so the server's `position` lands.
 *   deferred — keep the placement AND remember the card, so the skin can badge
 *              it "pending approval". Snapping it back would say "refused".
 *   denied   — drop the overlay (the card snaps back) and surface `reason_key`.
 *   failed   — drop the overlay and surface the transport failure.
 *
 * ── Filters ───────────────────────────────────────────────────────────────
 *
 * `column`, `category` and `assigneeId` are the server's own filters and travel
 * in the query key. `text` is NOT: stapel-tasks has no card search, so the
 * title filter runs in the client — putting it in the key would refetch the
 * whole board on every keystroke and get the same bytes back.
 */
import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  loadStateFromQuery,
  mapLoad,
  requireLoaded,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import { TASKS_EVENTS } from "../analytics/events.js";
import { isMoveResult } from "../api/enums.js";
import type { BoardCardsFilters } from "../api/tasksApi.js";
import type {
  Board,
  BoardCards,
  Column,
  ColumnCreateBody,
} from "../api/types.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import {
  applyMove,
  assembleBoard,
  cardCount,
  columnOf,
  filterByText,
  orderedColumns,
} from "../model/board.js";
import type { BoardMap } from "../model/board.js";
import { useTasksAnalytics } from "../model/context.js";
import {
  initialMoveState,
  keepsOptimisticPlacement,
  moveReducer,
} from "../model/move.js";
import type { MoveOutcome, MoveState } from "../model/move.js";
import {
  useAddColumn,
  useBoardCardsQuery,
  useBoardQuery,
  useMoveTask,
  useReorderColumns,
} from "../model/queries.js";

export interface BoardFilters {
  readonly column?: string;
  readonly category?: string;
  readonly assigneeId?: string;
  /** Client-side title filter — the backend has no card search. */
  readonly text?: string;
}

export interface BoardBag {
  readonly board: LoadState<Board>;
  readonly columns: LoadState<readonly Column[]>;
  /** Cards by column key, every column present, each group position-sorted. */
  readonly cards: LoadState<BoardMap>;
  /** The server's cap cut the answer short — the skin must say so. */
  readonly truncated: boolean;
  /** How many cards are on screen after filtering. */
  readonly count: number;
  readonly filters: BoardFilters;
  readonly setFilters: (next: BoardFilters) => void;
  readonly clearFilters: () => void;
  /** Cards whose last move came back `deferred`. */
  readonly deferredIds: ReadonlySet<string>;
  readonly moveState: MoveState;
  readonly beginDrag: (taskId: string) => void;
  readonly cancelDrag: () => void;
  readonly acknowledgeMove: () => void;
  readonly move: (
    taskId: string,
    toColumn: string,
    index: number
  ) => Promise<MoveOutcome>;
  readonly addColumn: ActionAvailability;
  readonly runAddColumn: (body: ColumnCreateBody) => Promise<void>;
  readonly addingColumn: boolean;
  readonly addColumnError: unknown;
  readonly reorderColumns: (keys: readonly string[]) => Promise<void>;
  readonly reorderingColumns: boolean;
  readonly reorderError: unknown;
  readonly refetch: () => void;
}

interface Overlay {
  /** The query payload this overlay was computed from. */
  readonly base: BoardCards;
  readonly map: BoardMap;
}

export function useBoard(
  boardId: string | undefined,
  initialFilters: BoardFilters = {}
): BoardBag {
  const [filters, setFiltersState] = useState<BoardFilters>(initialFilters);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [deferredIds, setDeferredIds] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  );
  const [moveState, dispatch] = useReducer(moveReducer, initialMoveState);
  const analytics = useTasksAnalytics();

  const serverFilters = useMemo<BoardCardsFilters>(() => {
    const next: {
      column?: string;
      category?: string;
      assigneeId?: string;
    } = {};
    if (filters.column !== undefined && filters.column !== "")
      next.column = filters.column;
    if (filters.category !== undefined && filters.category !== "")
      next.category = filters.category;
    if (filters.assigneeId !== undefined && filters.assigneeId !== "")
      next.assigneeId = filters.assigneeId;
    return next;
  }, [filters.assigneeId, filters.category, filters.column]);

  const boardQuery = useBoardQuery(boardId);
  const cardsQuery = useBoardCardsQuery(boardId, serverFilters);
  const moveMutation = useMoveTask();
  const addColumnMutation = useAddColumn(boardId ?? "");
  const reorderMutation = useReorderColumns(boardId ?? "");

  const payload = cardsQuery.data;
  /** The board as the SERVER last described it — the rollback target. */
  const assembled = useMemo<BoardMap | null>(
    () => (payload === undefined ? null : assembleBoard(payload)),
    [payload]
  );

  /** The overlay applies only to the payload it was computed from. */
  const effective = useMemo<BoardMap | null>(() => {
    if (assembled === null) return null;
    if (overlay !== null && overlay.base === payload) return overlay.map;
    return assembled;
  }, [assembled, overlay, payload]);

  const text = filters.text ?? "";
  const visible = useMemo<BoardMap | null>(
    () => (effective === null ? null : filterByText(effective, text)),
    [effective, text]
  );

  const cardsState = useMemo<LoadState<BoardMap>>(
    () =>
      mapLoad(loadStateFromQuery(cardsQuery), () =>
        visible === null ? new Map<string, readonly []>() : visible
      ),
    [cardsQuery, visible]
  );

  const columnsState = useMemo<LoadState<readonly Column[]>>(
    () => mapLoad(loadStateFromQuery(cardsQuery), orderedColumns),
    [cardsQuery]
  );

  /** Keeps `move` out of the render loop's dependency churn. */
  const effectiveRef = useRef<BoardMap | null>(effective);
  effectiveRef.current = effective;
  const payloadRef = useRef<BoardCards | undefined>(payload);
  payloadRef.current = payload;

  const setFilters = useCallback((next: BoardFilters) => {
    setFiltersState(next);
  }, []);
  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  const beginDrag = useCallback((taskId: string) => {
    const from = effectiveRef.current
      ? columnOf(effectiveRef.current, taskId)
      : null;
    dispatch({ type: "dragStart", taskId, fromColumn: from ?? "" });
  }, []);

  const cancelDrag = useCallback(() => {
    dispatch({ type: "dragCancel" });
  }, []);

  const acknowledgeMove = useCallback(() => {
    dispatch({ type: "acknowledge" });
  }, []);

  const move = useCallback(
    async (
      taskId: string,
      toColumn: string,
      index: number
    ): Promise<MoveOutcome> => {
      const base = payloadRef.current;
      const current = effectiveRef.current;
      if (base === undefined || current === null) return "failed";
      const fromColumn = columnOf(current, taskId) ?? "";
      const columns = orderedColumns(base);
      const category = columns.find((c) => c.key === toColumn)?.category;
      dispatch({ type: "drop", taskId, fromColumn, toColumn, index });
      setOverlay({
        base,
        map: applyMove(current, taskId, toColumn, index, category),
      });
      try {
        const answer = await moveMutation.mutateAsync({
          taskId,
          toColumn,
          index,
        });
        // `result` is a bare string on the wire (`MoveResponse.result`); a
        // value outside the vocabulary is treated as a refusal rather than
        // trusted into the union — an unknown answer must not keep a card
        // somewhere the server may not have put it.
        const result = isMoveResult(answer.result) ? answer.result : "denied";
        dispatch({
          type: "settled",
          result,
          reasonKey: answer.reason_key ?? null,
        });
        analytics?.track(TASKS_EVENTS.taskMoved, { outcome: result });
        if (result === "deferred") {
          setDeferredIds((prev) => new Set(prev).add(taskId));
        }
        if (keepsOptimisticPlacement(result)) {
          void cardsQuery.refetch();
        } else {
          setOverlay(null);
        }
        return result;
      } catch (error) {
        dispatch({ type: "failed", error });
        analytics?.track(TASKS_EVENTS.taskMoved, { outcome: "failed" });
        setOverlay(null);
        return "failed";
      }
    },
    [analytics, cardsQuery, moveMutation]
  );

  const runAddColumn = useCallback(
    async (body: ColumnCreateBody): Promise<void> => {
      await addColumnMutation.mutateAsync(body);
    },
    [addColumnMutation]
  );

  const reorderColumns = useCallback(
    async (keys: readonly string[]): Promise<void> => {
      await reorderMutation.mutateAsync(keys);
    },
    [reorderMutation]
  );

  const refetch = useCallback(() => {
    setOverlay(null);
    setDeferredIds(new Set<string>());
    void boardQuery.refetch();
    void cardsQuery.refetch();
  }, [boardQuery, cardsQuery]);

  const boardState = loadStateFromQuery(boardQuery);
  const addColumn = firstBlock(
    boardId === undefined || boardId === ""
      ? actionBlocked(TASKS_I18N_KEYS.boardNoBoard)
      : actionAvailable(),
    requireLoaded(columnsState, () => actionAvailable())
  );

  return {
    board: boardState,
    columns: columnsState,
    cards: cardsState,
    truncated: payload?.truncated === true,
    count: visible === null ? 0 : cardCount(visible),
    filters,
    setFilters,
    clearFilters,
    deferredIds,
    moveState,
    beginDrag,
    cancelDrag,
    acknowledgeMove,
    move,
    addColumn,
    runAddColumn,
    addingColumn: addColumnMutation.isPending,
    addColumnError: addColumnMutation.error,
    reorderColumns,
    reorderingColumns: reorderMutation.isPending,
    reorderError: reorderMutation.error,
    refetch,
  };
}
