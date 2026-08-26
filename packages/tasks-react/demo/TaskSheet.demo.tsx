/**
 * `TaskSheet` in the viewer — the card, opened.
 *
 * The `archived` variant is the one worth looking at twice: every control in
 * the sheet is gated by ONE `ActionAvailability`, so the read-only state is a
 * single stated reason repeated beside each control rather than nine independent
 * greyed-out boxes.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TaskSheet } from "../src/default/index.js";
import {
  DEMO_TASK_ID,
  archivedTask,
  columns,
  task,
} from "./fixtures.js";
import { TasksDemoHarness, boardHandlers } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

function Sheet(props: {
  handlers: DemoHandlers;
  featureDefs?: readonly unknown[];
}): ReactElement {
  return (
    <TasksDemoHarness handlers={props.handlers}>
      <TaskSheet
        open
        taskId={DEMO_TASK_ID}
        onClose={() => {
          // A demo keeps the sheet open so the viewer has something to look at.
        }}
        columns={columns}
        onColumnChange={() => {
          // Wired in the product by KanbanBoard, which owns the move.
        }}
        {...(props.featureDefs !== undefined
          ? { featureDefs: props.featureDefs }
          : {})}
      />
    </TasksDemoHarness>
  );
}

const READY = boardHandlers({ [`tasks/${DEMO_TASK_ID}`]: task });
const ARCHIVED = boardHandlers({ [`tasks/${DEMO_TASK_ID}`]: archivedTask });

export default defineDemo({
  id: "tasks.task-sheet",
  title: "Task sheet (default skin)",
  description:
    "One card: title and description saved on blur, column/priority/due controls, assignees through the host seam, a checklist with a three-state overflow menu, and comments where Enter sends and Shift+Enter breaks a line.",
  component: TaskSheet,
  variants: {
    default: {
      description: "Editable card, modal at desktop width.",
      viewport: "desktop",
      step: "ready",
      render: () => <Sheet handlers={READY} />,
    },
    phone: {
      description: "390px: the same card as a bottom sheet.",
      viewport: "phone",
      step: "ready-phone",
      render: () => <Sheet handlers={READY} />,
    },
    archived: {
      description:
        "An archived card: read-only, with one reason stated beside every control.",
      viewport: "desktop",
      step: "archived",
      render: () => <Sheet handlers={ARCHIVED} />,
    },
    features: {
      description:
        "A board with custom fields but no attributes editors wired: the slot names itself instead of leaving a hole.",
      viewport: "phone",
      step: "features",
      render: () => <Sheet handlers={READY} featureDefs={[{ slug: "effort" }]} />,
    },
  },
});
