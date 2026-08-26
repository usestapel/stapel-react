/**
 * The move state machine — the one place that knows what a drag can end as.
 *
 * `idle → dragging → dropping → applied | deferred | denied | failed`
 *
 * Four terminal states, not two, because the backend genuinely has four
 * answers and collapsing any pair of them lies to the person who dragged:
 *
 *   applied   200 — the card is where they put it.
 *   deferred  202 — the move is real but needs an approval; the card STAYS
 *                   where it was dropped and wears a badge. Snapping it back
 *                   would say "rejected", which is not what happened.
 *   denied    409 — the board's workflow refuses this transition. The card
 *                   snaps back and the refusal names itself from `reason_key`.
 *   failed     —   we could not ask (network, 500, 403). The card snaps back
 *                   and the message is about the request, not about the rule.
 *
 * The reducer is pure and exported so `test/moveFlow.test.ts` can drive the
 * whole table without React, a query client or a fake server.
 */
import type { MoveResult } from "../api/enums.js";

export type MoveStep =
  | "idle"
  | "dragging"
  | "dropping"
  | "applied"
  | "deferred"
  | "denied"
  | "failed";

/** What a completed move tells the caller. `failed` is the transport arm. */
export type MoveOutcome = MoveResult | "failed";

export interface MoveState {
  readonly step: MoveStep;
  /** The card being dragged / moved, `null` between moves. */
  readonly taskId: string | null;
  /** Where it came from — what a rollback restores. */
  readonly fromColumn: string | null;
  readonly toColumn: string | null;
  readonly index: number | null;
  /** The server's own reason key on `deferred` / `denied`. */
  readonly reasonKey: string | null;
  /** The thrown value on `failed` — handed to `ErrorAlert thrown=` untouched. */
  readonly error: unknown;
}

export type MoveEvent =
  | { readonly type: "dragStart"; readonly taskId: string; readonly fromColumn: string }
  | { readonly type: "dragCancel" }
  | {
      readonly type: "drop";
      readonly taskId: string;
      readonly fromColumn: string;
      readonly toColumn: string;
      readonly index: number;
    }
  | {
      readonly type: "settled";
      readonly result: MoveResult;
      readonly reasonKey?: string | null;
    }
  | { readonly type: "failed"; readonly error: unknown }
  | { readonly type: "acknowledge" };

export const initialMoveState: MoveState = {
  step: "idle",
  taskId: null,
  fromColumn: null,
  toColumn: null,
  index: null,
  reasonKey: null,
  error: null,
};

/**
 * The transition table. Unreachable pairs return the state unchanged rather
 * than throwing: dnd-kit can emit a `dragCancel` after a `drop` when a pointer
 * is released outside the window, and a board that threw on that would take
 * the whole screen down for a gesture nobody completed.
 */
export function moveReducer(state: MoveState, event: MoveEvent): MoveState {
  switch (event.type) {
    case "dragStart":
      return {
        ...initialMoveState,
        step: "dragging",
        taskId: event.taskId,
        fromColumn: event.fromColumn,
      };
    case "dragCancel":
      return state.step === "dragging" ? initialMoveState : state;
    case "drop":
      return {
        step: "dropping",
        taskId: event.taskId,
        fromColumn: event.fromColumn,
        toColumn: event.toColumn,
        index: event.index,
        reasonKey: null,
        error: null,
      };
    case "settled":
      if (state.step !== "dropping") return state;
      return {
        ...state,
        step: event.result,
        reasonKey: event.reasonKey ?? null,
        error: null,
      };
    case "failed":
      if (state.step !== "dropping") return state;
      return { ...state, step: "failed", reasonKey: null, error: event.error };
    case "acknowledge":
      return state.step === "dropping" || state.step === "dragging"
        ? state
        : initialMoveState;
    default:
      return state;
  }
}

/**
 * Does this outcome keep the optimistic placement, or roll it back?
 *
 * The single fact the board's cache update branches on, spelled once so the
 * skin cannot decide it differently from the machine.
 */
export function keepsOptimisticPlacement(step: MoveStep): boolean {
  return step === "applied" || step === "deferred";
}

/** The i18n key suffix a settled move renders — see `TASKS_I18N_KEYS.move*`. */
export function outcomeOf(step: MoveStep): MoveOutcome | null {
  switch (step) {
    case "applied":
    case "deferred":
    case "denied":
    case "failed":
      return step;
    default:
      return null;
  }
}
