// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyMove,
  assembleBoard,
  cardCount,
  checklistProgress,
  columnOf,
  compareCards,
  filterByText,
  findCard,
  orderedColumns,
  scaledPosition,
} from "../src/model/board.js";
import type { BoardCards, Column, Task } from "../src/index.js";

function column(key: string, order: number): Column {
  return {
    id: `c-${key}`,
    board_id: "b",
    key,
    name: key,
    name_key: "",
    order,
    category: "backlog",
    wip_limit: null,
  };
}

function card(id: string, columnKey: string, position: string, over: Partial<Task> = {}): Task {
  return {
    id,
    board_id: "b",
    column: columnKey,
    category: "backlog",
    position,
    title: id,
    description: "",
    creator_id: null,
    assignee_ids: [],
    priority: null,
    due_at: null,
    parent_id: null,
    blocked_by_ids: [],
    features: {},
    checklist: [],
    created_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

describe("scaledPosition — a fractional position is a DECIMAL, not a float", () => {
  it("scales an integer and a fraction to the same scale", () => {
    expect(scaledPosition("1")).toBe(scaledPosition("1.000000"));
    expect(scaledPosition("1.5")).toBeGreaterThan(scaledPosition("1"));
  });

  it("keeps digits IEEE-754 would have lost", () => {
    // Two midpoints that differ in the 18th fractional digit. `Number()` gives
    // both the same double, so a float sort would call them equal and the two
    // cards would swap places on every refetch.
    const a = "1.000000000000000001";
    const b = "1.000000000000000002";
    expect(Number(a) === Number(b)).toBe(true);
    expect(scaledPosition(a)).not.toBe(scaledPosition(b));
    expect(scaledPosition(a) < scaledPosition(b)).toBe(true);
  });

  it("orders negatives below zero", () => {
    expect(scaledPosition("-2.5") < scaledPosition("0")).toBe(true);
    expect(scaledPosition("-2.5") < scaledPosition("-1")).toBe(true);
  });

  it("sorts unreadable input as zero instead of throwing", () => {
    expect(scaledPosition("not-a-number")).toBe(0n);
    expect(scaledPosition("")).toBe(0n);
  });
});

describe("compareCards — a TOTAL order, so the sort cannot be unstable", () => {
  it("falls back to created_at, then id, when positions tie", () => {
    const a = card("a", "todo", "1", { created_at: "2026-08-02T00:00:00Z" });
    const b = card("b", "todo", "1", { created_at: "2026-08-01T00:00:00Z" });
    expect(compareCards(a, b)).toBeGreaterThan(0);

    const c = card("c", "todo", "1");
    const d = card("d", "todo", "1");
    expect(compareCards(c, d)).toBeLessThan(0);
    expect(compareCards(c, c)).toBe(0);
  });
});

const payload: BoardCards = {
  board_id: "b",
  columns: [column("done", 2), column("todo", 0), column("doing", 1)],
  cards: {
    todo: [card("t2", "todo", "2"), card("t1", "todo", "1")],
    doing: [card("d1", "doing", "1.5")],
    // `done` sends no group at all — an empty column, not a missing one.
    ghost: [card("g1", "ghost", "1")],
  },
  count: 4,
  truncated: false,
};

describe("assembleBoard", () => {
  it("keys every column of the board, including the ones with no cards", () => {
    const map = assembleBoard(payload);
    expect([...map.keys()].sort()).toEqual(["doing", "done", "todo"]);
    expect(map.get("done")).toEqual([]);
  });

  it("sorts each group by position", () => {
    const map = assembleBoard(payload);
    expect((map.get("todo") ?? []).map((c) => c.id)).toEqual(["t1", "t2"]);
  });

  it("drops a group whose column is not on the board", () => {
    const map = assembleBoard(payload);
    expect(map.has("ghost")).toBe(false);
  });

  it("orders the columns by `order`, whatever order they arrived in", () => {
    expect(orderedColumns(payload).map((c) => c.key)).toEqual([
      "todo",
      "doing",
      "done",
    ]);
  });

  it("counts what is on screen", () => {
    expect(cardCount(assembleBoard(payload))).toBe(3);
  });
});

describe("applyMove — the optimistic placement", () => {
  const map = assembleBoard(payload);

  it("moves a card across columns at the requested index", () => {
    const next = applyMove(map, "t1", "doing", 0, "active");
    expect((next.get("doing") ?? []).map((c) => c.id)).toEqual(["t1", "d1"]);
    expect((next.get("todo") ?? []).map((c) => c.id)).toEqual(["t2"]);
    expect(findCard(next, "t1")?.column).toBe("doing");
    expect(findCard(next, "t1")?.category).toBe("active");
  });

  it("clamps an index past the end rather than leaving a hole", () => {
    const next = applyMove(map, "t1", "doing", 99);
    expect((next.get("doing") ?? []).map((c) => c.id)).toEqual(["d1", "t1"]);
  });

  it("reorders within one column", () => {
    const next = applyMove(map, "t2", "todo", 0);
    expect((next.get("todo") ?? []).map((c) => c.id)).toEqual(["t2", "t1"]);
  });

  it("does nothing for an unknown card or an unknown column", () => {
    expect(applyMove(map, "nope", "todo", 0)).toBe(map);
    expect(applyMove(map, "t1", "nope", 0)).toBe(map);
  });

  it("leaves the input map untouched — the rollback target survives", () => {
    applyMove(map, "t1", "doing", 0);
    expect((map.get("todo") ?? []).map((c) => c.id)).toEqual(["t1", "t2"]);
  });
});

describe("client-side helpers", () => {
  it("filters titles case-insensitively without touching the columns", () => {
    const map = assembleBoard(payload);
    const filtered = filterByText(map, "T1");
    expect([...filtered.keys()].sort()).toEqual(["doing", "done", "todo"]);
    expect(cardCount(filtered)).toBe(1);
    expect(filterByText(map, "  ")).toBe(map);
  });

  it("finds which column a card sits in", () => {
    const map = assembleBoard(payload);
    expect(columnOf(map, "d1")).toBe("doing");
    expect(columnOf(map, "nope")).toBe(null);
  });

  it("reports checklist progress only when there is a checklist", () => {
    expect(checklistProgress(card("x", "todo", "1"))).toBe(null);
    expect(
      checklistProgress(
        card("x", "todo", "1", {
          checklist: [
            { id: "s1", text: "a", state: "done", order: 0 },
            { id: "s2", text: "b", state: "pending", order: 1 },
            { id: "s3", text: "c", state: "failed", order: 2 },
          ],
        })
      )
    ).toEqual({ done: 1, total: 3 });
  });
});
