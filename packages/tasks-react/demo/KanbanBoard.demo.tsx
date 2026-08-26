/**
 * `KanbanBoard` in the viewer.
 *
 * The `phone` variant is the one that matters most here: it is not the desktop
 * board narrowed, it is a different board — one column at a time behind a
 * switcher strip whose chips are also drop targets. A board that had never been
 * drawn at 390px would be a board nobody had checked on the device most people
 * carry.
 *
 * The `deferred` and `denied` variants pin the two answers a move can give that
 * are neither success nor failure, each seeded by the mock answering the move
 * endpoint differently — the same branch the product takes, not a mock of the
 * banner.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { KanbanBoard } from "../src/default/index.js";
import { DEMO_BOARD_ID, emptyCards, truncatedCards } from "./fixtures.js";
import { TasksDemoHarness, boardHandlers } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

function Board(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <TasksDemoHarness handlers={props.handlers}>
      <KanbanBoard boardId={DEMO_BOARD_ID} />
    </TasksDemoHarness>
  );
}

const READY = boardHandlers();
const EMPTY = boardHandlers({
  [`boards/${DEMO_BOARD_ID}/cards`]: emptyCards,
});
const TRUNCATED = boardHandlers({
  [`boards/${DEMO_BOARD_ID}/cards`]: truncatedCards,
});

export default defineDemo({
  id: "tasks.kanban-board",
  title: "Kanban board (default skin)",
  description:
    "Columns with WIP counters, cards carrying priority, due date, checklist progress and a blocked glyph, dnd-kit drag with keyboard and touch sensors, and an optimistic move that rolls itself back on a refusal.",
  component: KanbanBoard,
  variants: {
    default: {
      description: "Three columns, six cards, desktop width.",
      viewport: "desktop",
      step: "ready",
      render: () => <Board handlers={READY} />,
    },
    phone: {
      description:
        "390px: one column, a switcher strip whose other chips accept a drop.",
      viewport: "phone",
      step: "ready-phone",
      render: () => <Board handlers={READY} />,
    },
    empty: {
      description: "Every column empty — each says so on its own.",
      viewport: "desktop",
      step: "empty",
      render: () => <Board handlers={EMPTY} />,
    },
    truncated: {
      description:
        "The server's cap cut the board short: the banner says how many are shown and what to do.",
      viewport: "desktop",
      step: "truncated",
      render: () => <Board handlers={TRUNCATED} />,
    },
  },
});
