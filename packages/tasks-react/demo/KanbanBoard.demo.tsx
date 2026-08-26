/**
 * `KanbanBoard` in the viewer.
 *
 * At 390px this is not the desktop board narrowed, it is a different board —
 * one column at a time behind a switcher strip whose chips are also drop
 * targets. That switch is driven by the width, not by a prop, so it is the
 * viewer's width control that shows it: a second variant rendering the same
 * tree photographed the identical frame under a second name.
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
  // The board screen mounts the renderless layer it is built on: the provider
  // wires the runtime and `BoardView` hands over the assembled columns. They
  // used to have a separate `state.step` chip-dump demo of their own, which
  // photographed the harness rather than the product (visual pass N-4).
  covers: ["TasksProvider", "BoardView"],
  variants: {
    default: {
      description:
        "Three columns, six cards. Below the tablet breakpoint the same board becomes one column behind a switcher strip whose chips are drop targets, so the viewer's width control shows it — a duplicate `phone` variant photographed the identical frame.",
      viewport: "phone",
      step: "ready",
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
