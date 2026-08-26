/**
 * The default skin, rendered.
 *
 * Every assertion here is about something a person can see or reach: the phone
 * board is one column with a switcher, the drag handle is a focusable control
 * with a name, a refusal is TEXT beside a control rather than a tooltip nobody
 * can trigger, and the surface follows the document's theme instead of a
 * `mode="light"` literal.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { BoardsPane, ColumnManager, KanbanBoard } from "../src/default/index.js";
import { actionAvailable, loadReady } from "@stapel/core";
import { StapelApiError } from "@stapel/core";
import { BOARD_ID, Harness, routedFetch, setViewport } from "./helpers.js";

const PHONE = 390;
const DESKTOP = 1280;

const columns = [
  {
    id: "c1",
    board_id: BOARD_ID,
    key: "todo",
    name: "To do",
    name_key: "tasks.column.todo",
    order: 0,
    category: "backlog",
    wip_limit: 1,
  },
  {
    id: "c2",
    board_id: BOARD_ID,
    key: "done",
    name: "Done",
    name_key: "tasks.column.done",
    order: 1,
    category: "done",
    wip_limit: null,
  },
];

function card(id: string, columnKey: string, title: string, position: string) {
  return {
    id,
    board_id: BOARD_ID,
    column: columnKey,
    category: columnKey === "done" ? "done" : "backlog",
    position,
    title,
    description: "",
    creator_id: null,
    assignee_ids: [],
    blocked_by_ids: [],
    features: {},
    checklist: [],
    created_at: "2026-08-01T00:00:00Z",
  };
}

const cards = {
  board_id: BOARD_ID,
  columns,
  cards: {
    todo: [card("t1", "todo", "Card one", "1"), card("t2", "todo", "Card two", "2")],
    done: [],
  },
  count: 2,
  truncated: false,
};

const board = { id: BOARD_ID, name: "Launch", slug: "launch", workspace_id: null, columns };

function boardFetch(overrides: Record<string, unknown> = {}) {
  return routedFetch({
    "boards/presets": { presets: [], categories: [], checklist_states: [], priority_scale: [] },
    [`boards/${BOARD_ID}/cards`]: cards,
    [`boards/${BOARD_ID}/columns`]: columns,
    [`boards/${BOARD_ID}`]: board,
    boards: [board],
    ...overrides,
  });
}

afterEach(() => {
  cleanup();
});

describe("<KanbanBoard> — the board a person actually gets", () => {
  it("draws every column at desktop width", async () => {
    setViewport(DESKTOP);
    render(
      <Harness fetch={boardFetch()}>
        <KanbanBoard boardId={BOARD_ID} />
      </Harness>
    );
    await waitFor(() => {
      expect(document.querySelector('[data-testid="tasks-column-todo"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-testid="tasks-column-done"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="tasks-column-switcher"]')).toBeNull();
  });

  it("at 390px shows ONE column and a switcher strip", async () => {
    setViewport(PHONE);
    render(
      <Harness fetch={boardFetch()}>
        <KanbanBoard boardId={BOARD_ID} />
      </Harness>
    );
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="tasks-column-switcher"]')
      ).not.toBeNull();
    });
    expect(document.querySelector('[data-testid="tasks-column-todo"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="tasks-column-done"]')).toBeNull();
    // The off-screen column is still reachable — as a chip that is also a
    // drop target.
    expect(
      document.querySelector('[data-testid="tasks-switcher-done"]')
    ).not.toBeNull();
  });

  it("gives every card a NAMED, focusable drag handle (the keyboard path)", async () => {
    setViewport(DESKTOP);
    render(
      <Harness fetch={boardFetch()}>
        <KanbanBoard boardId={BOARD_ID} />
      </Harness>
    );
    await waitFor(() => {
      expect(document.querySelector('[data-testid="tasks-card-handle-t1"]')).not.toBeNull();
    });
    const handle = document.querySelector<HTMLButtonElement>(
      '[data-testid="tasks-card-handle-t1"]'
    );
    expect(handle?.getAttribute("aria-label")).toBe("Drag Card one");
    // dnd-kit's keyboard sensor needs the activator to be reachable and to
    // advertise itself as a draggable; both come from `attributes`.
    expect(handle?.getAttribute("role")).toBe("button");
    expect(handle?.getAttribute("aria-roledescription")).toBeTruthy();
    expect(handle?.tabIndex).toBe(0);
  });

  it("shows the WIP counter and warns when a column is over its limit", async () => {
    setViewport(DESKTOP);
    render(
      <Harness fetch={boardFetch()}>
        <KanbanBoard boardId={BOARD_ID} />
      </Harness>
    );
    await waitFor(() => {
      expect(document.querySelector('[data-testid="tasks-wip-todo"]')).not.toBeNull();
    });
    const wip = document.querySelector('[data-testid="tasks-wip-todo"]');
    expect(wip?.textContent).toBe("2/1");
    // The limit is decorative server-side, so the client SAYS it is exceeded
    // and still lets the drop happen — the reason is text, not a tooltip.
    expect(wip?.getAttribute("aria-label")).toBe("Over the WIP limit of 1");
  });

  it("says so when the server cut the board short", async () => {
    setViewport(DESKTOP);
    render(
      <Harness
        fetch={boardFetch({
          [`boards/${BOARD_ID}/cards`]: { ...cards, truncated: true },
        })}
      >
        <KanbanBoard boardId={BOARD_ID} />
      </Harness>
    );
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="tasks-board-truncated"]')
      ).not.toBeNull();
    });
    expect(
      document.querySelector('[data-testid="tasks-board-truncated"]')?.textContent
    ).toContain("Showing the newest 2 cards");
  });

  it("without a boardId it names the situation instead of drawing an empty frame", () => {
    setViewport(PHONE);
    render(
      <Harness fetch={boardFetch()}>
        <KanbanBoard />
      </Harness>
    );
    expect(screen.getByText("No board selected")).toBeTruthy();
  });

  it("follows the document's theme rather than a light literal", async () => {
    setViewport(DESKTOP);
    render(
      <Harness fetch={boardFetch()}>
        <KanbanBoard boardId={BOARD_ID} />
      </Harness>
    );
    expect(
      document.querySelector("[data-stapel-skin-mode]")?.getAttribute("data-stapel-skin-mode")
    ).toBe("light");
    document.documentElement.setAttribute("data-theme", "dark");
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      document.querySelector("[data-stapel-skin-mode]")?.getAttribute("data-stapel-skin-mode")
    ).toBe("dark");
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders the column name from its name_key, translated", async () => {
    setViewport(DESKTOP);
    render(
      <Harness locale="ru" fetch={boardFetch()}>
        <KanbanBoard boardId={BOARD_ID} />
      </Harness>
    );
    await waitFor(() => {
      expect(document.querySelector('[data-testid="tasks-column-todo"]')).not.toBeNull();
    });
    expect(
      document.querySelector('[data-testid="tasks-column-todo"]')?.textContent
    ).toContain("К выполнению");
  });
});

describe("<BoardsPane> — four states, four sentences", () => {
  it("lists boards and offers the create sheet", async () => {
    setViewport(DESKTOP);
    render(
      <Harness fetch={boardFetch()}>
        <BoardsPane onOpenBoard={() => undefined} />
      </Harness>
    );
    await waitFor(() => {
      expect(screen.getByText("Launch")).toBeTruthy();
    });
    expect(document.querySelector('[data-testid="tasks-boards-create"]')).not.toBeNull();
  });

  it("an empty list carries the create button, not a dead end", async () => {
    setViewport(PHONE);
    render(
      <Harness fetch={boardFetch({ boards: [] })}>
        <BoardsPane onOpenBoard={() => undefined} />
      </Harness>
    );
    await waitFor(() => {
      expect(
        document.querySelector('[data-stapel-load-state="empty"]')
      ).not.toBeNull();
    });
    expect(screen.getAllByText("New board").length).toBeGreaterThan(0);
  });

  it("a failed list is a refusal with a retry, never 'you have no boards'", async () => {
    setViewport(DESKTOP);
    render(
      <Harness
        fetch={boardFetch({
          boards: [503, { localizable_error: "error.503.tasks_scope_unresolved" }],
        })}
      >
        <BoardsPane onOpenBoard={() => undefined} />
      </Harness>
    );
    await waitFor(() => {
      expect(
        document.querySelector('[data-stapel-load-state="failed"]')
      ).not.toBeNull();
    });
    expect(document.querySelector('[data-stapel-load-state="empty"]')).toBeNull();
  });

  it("with no navigation wired, the Open control states the reason as TEXT", async () => {
    setViewport(DESKTOP);
    render(
      <Harness fetch={boardFetch()}>
        <BoardsPane />
      </Harness>
    );
    await waitFor(() => {
      expect(
        document.querySelector(`[data-testid="tasks-board-open-${BOARD_ID}-gate"]`)
      ).not.toBeNull();
    });
    const gate = document.querySelector(
      `[data-testid="tasks-board-open-${BOARD_ID}-gate"]`
    );
    expect(gate?.getAttribute("data-stapel-gated")).toBe("blocked");
    const reason = gate?.querySelector("[data-stapel-gated-reason]");
    expect(reason?.textContent).toContain("has not wired board navigation");
    // The button points at the reason, so a screen reader gets it too.
    const button = gate?.querySelector("button");
    expect(button?.getAttribute("aria-describedby")).toBe(reason?.id);
    // The reason is beside the control, not inside a title attribute nobody
    // can trigger on a disabled button.
    expect(document.querySelectorAll("[title]").length).toBe(0);
  });
});

describe("<ColumnManager> — a missing capability is explained, not faked", () => {
  const noop = () => Promise.resolve();

  it("says why rename and delete are absent instead of drawing them", () => {
    setViewport(PHONE);
    render(
      <Harness>
        <ColumnManager
          columns={loadReady(columns)}
          onReorder={noop}
          addColumn={actionAvailable()}
          onAddColumn={noop}
        />
      </Harness>
    );
    expect(
      screen.getByText(/Renaming and deleting a column are not part of this API/)
    ).toBeTruthy();
  });

  it("each column row carries a named reorder handle", () => {
    setViewport(DESKTOP);
    render(
      <Harness>
        <ColumnManager
          columns={loadReady(columns)}
          onReorder={noop}
          addColumn={actionAvailable()}
          onAddColumn={noop}
        />
      </Harness>
    );
    expect(screen.getByLabelText("Reorder To do")).toBeTruthy();
    expect(screen.getByLabelText("Reorder Done")).toBeTruthy();
  });

  it("renders a duplicate key as a NAMED 409 with the fix beside it", () => {
    setViewport(PHONE);
    render(
      <Harness>
        <ColumnManager
          columns={loadReady(columns)}
          onReorder={noop}
          addColumn={actionAvailable()}
          onAddColumn={noop}
          addError={
            new StapelApiError({
              code: "error.409.tasks_column_exists",
              message: "A column with this key already exists on the board",
              status: 409,
            })
          }
        />
      </Harness>
    );
    const alert = document.querySelector('[data-testid="tasks-columns-duplicate"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain("already exists");
    expect(alert?.textContent).toContain("Pick a key this board does not already use");
  });
});
