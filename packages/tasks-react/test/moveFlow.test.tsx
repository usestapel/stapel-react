/**
 * The move state machine, twice: once as a pure transition table, once through
 * the real `useBoard` against a mocked wire, because the two failures this
 * feature can have live at different levels — a wrong transition, and a
 * rollback that never happens.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import {
  initialMoveState,
  keepsOptimisticPlacement,
  moveReducer,
  outcomeOf,
  useBoard,
} from "../src/index.js";
import type { MoveState } from "../src/index.js";
import { BOARD_ID, Harness, routedFetch } from "./helpers.js";

afterEach(() => {
  cleanup();
});

function drive(events: Parameters<typeof moveReducer>[1][]): MoveState {
  return events.reduce(moveReducer, initialMoveState);
}

describe("moveReducer — four endings, and none of them is another's branch", () => {
  it("idle → dragging → dropping → applied", () => {
    const state = drive([
      { type: "dragStart", taskId: "t1", fromColumn: "todo" },
      { type: "drop", taskId: "t1", fromColumn: "todo", toColumn: "doing", index: 0 },
      { type: "settled", result: "applied" },
    ]);
    expect(state.step).toBe("applied");
    expect(state.toColumn).toBe("doing");
    expect(state.reasonKey).toBe(null);
  });

  it("carries the server's reason_key on deferred and on denied", () => {
    for (const result of ["deferred", "denied"] as const) {
      const state = drive([
        { type: "drop", taskId: "t1", fromColumn: "todo", toColumn: "done", index: 0 },
        { type: "settled", result, reasonKey: "error.409.tasks_transition_not_allowed" },
      ]);
      expect(state.step).toBe(result);
      expect(state.reasonKey).toBe("error.409.tasks_transition_not_allowed");
    }
  });

  it("keeps the thrown value on a transport failure", () => {
    const boom = new Error("offline");
    const state = drive([
      { type: "drop", taskId: "t1", fromColumn: "todo", toColumn: "done", index: 0 },
      { type: "failed", error: boom },
    ]);
    expect(state.step).toBe("failed");
    expect(state.error).toBe(boom);
  });

  it("a cancelled drag returns to idle; a cancel AFTER a drop is ignored", () => {
    expect(
      drive([
        { type: "dragStart", taskId: "t1", fromColumn: "todo" },
        { type: "dragCancel" },
      ])
    ).toEqual(initialMoveState);

    const afterDrop = drive([
      { type: "drop", taskId: "t1", fromColumn: "todo", toColumn: "done", index: 0 },
      { type: "dragCancel" },
    ]);
    expect(afterDrop.step).toBe("dropping");
  });

  it("a late `settled` for a move nobody started changes nothing", () => {
    expect(moveReducer(initialMoveState, { type: "settled", result: "applied" })).toBe(
      initialMoveState
    );
  });

  it("acknowledge clears a settled move but never an in-flight one", () => {
    const settled = drive([
      { type: "drop", taskId: "t1", fromColumn: "todo", toColumn: "done", index: 0 },
      { type: "settled", result: "denied" },
    ]);
    expect(moveReducer(settled, { type: "acknowledge" })).toEqual(initialMoveState);

    const inFlight = drive([
      { type: "drop", taskId: "t1", fromColumn: "todo", toColumn: "done", index: 0 },
    ]);
    expect(moveReducer(inFlight, { type: "acknowledge" })).toBe(inFlight);
  });

  it("only applied and deferred keep the card where it was dropped", () => {
    expect(keepsOptimisticPlacement("applied")).toBe(true);
    expect(keepsOptimisticPlacement("deferred")).toBe(true);
    expect(keepsOptimisticPlacement("denied")).toBe(false);
    expect(keepsOptimisticPlacement("failed")).toBe(false);
    expect(keepsOptimisticPlacement("dropping")).toBe(false);
  });

  it("outcomeOf names only the terminal steps", () => {
    expect(outcomeOf("idle")).toBe(null);
    expect(outcomeOf("dragging")).toBe(null);
    expect(outcomeOf("dropping")).toBe(null);
    expect(outcomeOf("denied")).toBe("denied");
  });
});

// ── the same table, through the real hook ───────────────────────────────────

const COLUMNS = [
  {
    id: "c1",
    board_id: BOARD_ID,
    key: "todo",
    name: "To do",
    name_key: "",
    order: 0,
    category: "backlog",
    wip_limit: null,
  },
  {
    id: "c2",
    board_id: BOARD_ID,
    key: "done",
    name: "Done",
    name_key: "",
    order: 1,
    category: "done",
    wip_limit: null,
  },
];

const CARDS = {
  board_id: BOARD_ID,
  columns: COLUMNS,
  cards: {
    todo: [
      {
        id: "t1",
        board_id: BOARD_ID,
        column: "todo",
        category: "backlog",
        position: "1",
        title: "Card one",
        description: "",
        creator_id: null,
        assignee_ids: [],
        blocked_by_ids: [],
        features: {},
        checklist: [],
        created_at: "2026-08-01T00:00:00Z",
      },
    ],
    done: [],
  },
  count: 1,
  truncated: false,
};

function wrapperWith(move: unknown | readonly [number, unknown]) {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return (
      <Harness
        fetch={routedFetch({
          "tasks/t1/move": move,
          [`boards/${BOARD_ID}/cards`]: CARDS,
          [`boards/${BOARD_ID}`]: { id: BOARD_ID, name: "B", slug: "b", workspace_id: null },
        })}
      >
        {props.children}
      </Harness>
    );
  };
}

async function boardHook(move: unknown | readonly [number, unknown]) {
  const rendered = renderHook(() => useBoard(BOARD_ID), {
    wrapper: wrapperWith(move),
  });
  await waitFor(() => {
    expect(rendered.result.current.cards.status).toBe("ready");
  });
  return rendered;
}

function columnIds(bag: ReturnType<typeof useBoard>, key: string): string[] {
  if (bag.cards.status !== "ready") return [];
  return (bag.cards.data.get(key) ?? []).map((card) => card.id);
}

describe("useBoard.move — optimistic, then kept or rolled back", () => {
  it("applied: the card stays in its new column", async () => {
    const { result } = await boardHook({ result: "applied", reason_key: null });
    await act(async () => {
      const outcome = await result.current.move("t1", "done", 0);
      expect(outcome).toBe("applied");
    });
    expect(columnIds(result.current, "done")).toEqual(["t1"]);
    expect(columnIds(result.current, "todo")).toEqual([]);
    expect(result.current.moveState.step).toBe("applied");
  });

  it("deferred: the card stays AND is badged pending", async () => {
    const { result } = await boardHook({
      result: "deferred",
      reason_key: "error.409.tasks_transition_not_allowed",
    });
    await act(async () => {
      expect(await result.current.move("t1", "done", 0)).toBe("deferred");
    });
    expect(columnIds(result.current, "done")).toEqual(["t1"]);
    expect(result.current.deferredIds.has("t1")).toBe(true);
    expect(result.current.moveState.reasonKey).toBe(
      "error.409.tasks_transition_not_allowed"
    );
  });

  it("denied (a 409 carrying a MoveResponse): the card snaps back", async () => {
    const { result } = await boardHook([
      409,
      { result: "denied", reason_key: "error.409.tasks_transition_not_allowed" },
    ]);
    await act(async () => {
      expect(await result.current.move("t1", "done", 0)).toBe("denied");
    });
    expect(columnIds(result.current, "todo")).toEqual(["t1"]);
    expect(columnIds(result.current, "done")).toEqual([]);
    expect(result.current.moveState.step).toBe("denied");
    expect(result.current.deferredIds.has("t1")).toBe(false);
  });

  it("a transport failure also snaps back, with the error kept", async () => {
    const { result } = await boardHook([500, { localizable_error: "error.500.internal" }]);
    await act(async () => {
      expect(await result.current.move("t1", "done", 0)).toBe("failed");
    });
    expect(columnIds(result.current, "todo")).toEqual(["t1"]);
    expect(result.current.moveState.step).toBe("failed");
    expect(result.current.moveState.error).toBeTruthy();
  });

  it("an unknown `result` word is treated as a refusal, not trusted", async () => {
    const { result } = await boardHook({ result: "maybe", reason_key: null });
    await act(async () => {
      expect(await result.current.move("t1", "done", 0)).toBe("denied");
    });
    expect(columnIds(result.current, "todo")).toEqual(["t1"]);
  });

  it("acknowledging a settled move clears the status region", async () => {
    const { result } = await boardHook([
      409,
      { result: "denied", reason_key: null },
    ]);
    await act(async () => {
      await result.current.move("t1", "done", 0);
    });
    act(() => {
      result.current.acknowledgeMove();
    });
    expect(result.current.moveState.step).toBe("idle");
  });
});
