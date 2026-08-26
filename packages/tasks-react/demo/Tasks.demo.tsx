/**
 * The HEADLESS layer in the viewer — the part a host REPLACES.
 *
 * `BoardView` and `TaskView` render nothing of their own, so a demo of them can
 * only show what they hand over: the board assembled into columns, and one
 * card's fields. That is the point — the bag below is drawn with three lines of
 * token-styled markup, which is roughly what a host's own design system has to
 * write to build a board on top of this pair.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { matchLoad } from "@stapel/core";
import { BoardView, TaskView, TasksProvider } from "../src/index.js";
import { DEMO_BOARD_ID, DEMO_TASK_ID } from "./fixtures.js";
import { TasksDemoHarness, DemoCard, StepBadge, boardHandlers } from "./_harness.js";

function HeadlessDemo(): ReactElement {
  return (
    <TasksDemoHarness handlers={boardHandlers()}>
      <DemoCard heading="BoardView">
        <BoardView boardId={DEMO_BOARD_ID}>
          {(bag) => (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
              <StepBadge step={bag.moveState.step} />
              {matchLoad(bag.cards, {
                loading: () => <StepBadge step="cards.loading" />,
                failed: () => <StepBadge step="cards.failed" />,
                ready: (map) => (
                  <ul>
                    {[...map].map(([key, group]) => (
                      <li key={key}>
                        <code>{`${key}: ${String(group.length)}`}</code>
                      </li>
                    ))}
                  </ul>
                ),
              })}
            </div>
          )}
        </BoardView>
      </DemoCard>
      <DemoCard heading="TaskView">
        <TaskView taskId={DEMO_TASK_ID}>
          {(bag) =>
            matchLoad(bag.task, {
              loading: () => <StepBadge step="task.loading" />,
              failed: () => <StepBadge step="task.failed" />,
              ready: (row) => (
                <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
                  <code>{row.title}</code>
                  <StepBadge step={bag.canEdit.available ? "editable" : "read-only"} />
                </div>
              ),
            })
          }
        </TaskView>
      </DemoCard>
    </TasksDemoHarness>
  );
}

export default defineDemo({
  id: "tasks.headless",
  title: "Tasks headless bags",
  description:
    "The renderless layer: TasksProvider wires the runtime, BoardView hands over the assembled board (columns, cards, the move machine's step) and TaskView hands over one card with its canEdit gate. No visual opinion at all.",
  component: TasksProvider,
  covers: ["BoardView", "TaskView"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      description: "Desktop width, the board and one card resolved.",
      viewport: "desktop",
      step: "ready",
      render: () => <HeadlessDemo />,
    },
    phone: {
      description: "The same bags at 390px — the layer has no geometry of its own.",
      viewport: "phone",
      step: "ready-phone",
      render: () => <HeadlessDemo />,
    },
  },
});
