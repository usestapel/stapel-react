/**
 * `TaskSheet` in the viewer — the card, opened.
 *
 * The `archived` variant is the one worth looking at twice: every control in
 * the sheet is gated by ONE `ActionAvailability`, so the read-only state is a
 * single stated reason repeated beside each control rather than nine independent
 * greyed-out boxes.
 */
import type { ReactElement } from "react";
import { Flex, Input, Typography } from "antd";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { TaskSheet } from "../src/default/index.js";
import {
  DEMO_TASK_ID,
  archivedTask,
  columns,
  task,
} from "./fixtures.js";
import { TasksDemoHarness, boardHandlers } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

/** A board's custom field, as the demo's stand-in for a real editor. */
interface DemoFeatureDef {
  readonly slug: string;
  readonly name: string;
}

/**
 * What a host puts in the `renderFeatures` seam.
 *
 * The variant used to pass `featureDefs` and no renderer, which draws
 * `SlotPlaceholder` — and that is a DEV-only component: in the built showcase
 * it renders nothing at all, so the variant documenting custom fields
 * photographed a card with no custom fields on it (visual pass M-6). The seam
 * is filled here the way a host fills it.
 */
function DemoFeatureEditor(props: {
  features: Readonly<Record<string, unknown>>;
  featureDefs: readonly unknown[];
  disabled: boolean;
}): ReactElement {
  return (
    <Flex vertical gap={spacing[2]}>
      {(props.featureDefs as readonly DemoFeatureDef[]).map((def) => (
        <label key={def.slug}>
          <Typography.Text>{def.name}</Typography.Text>
          <Input
            readOnly
            disabled={props.disabled}
            value={String(props.features[def.slug] ?? "")}
            data-testid={`demo-feature-${def.slug}`}
          />
        </label>
      ))}
    </Flex>
  );
}

function Sheet(props: {
  handlers: DemoHandlers;
  featureDefs?: readonly DemoFeatureDef[];
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
          ? {
              featureDefs: props.featureDefs,
              renderFeatures: (args: {
                features: Readonly<Record<string, unknown>>;
                featureDefs: readonly unknown[];
                disabled: boolean;
              }) => <DemoFeatureEditor {...args} />,
            }
          : {})}
      />
    </TasksDemoHarness>
  );
}

const READY = boardHandlers({ [`tasks/${DEMO_TASK_ID}`]: task });
const ARCHIVED = boardHandlers({ [`tasks/${DEMO_TASK_ID}`]: archivedTask });
const FEATURED = boardHandlers({
  [`tasks/${DEMO_TASK_ID}`]: {
    ...task,
    features: { effort: "3 days", customer: "Northwind" },
  },
});

export default defineDemo({
  id: "tasks.task-sheet",
  title: "Task sheet (default skin)",
  description:
    "One card: title and description saved on blur, column/priority/due controls, assignees through the host seam, a checklist with a three-state overflow menu, and comments where Enter sends and Shift+Enter breaks a line.",
  component: TaskSheet,
  // The sheet IS `TaskView` with a skin on it: one card, its fields and its
  // `canEdit` gate.
  covers: ["TaskView"],
  variants: {
    default: {
      description:
        "Editable card — a bottom sheet under the tablet breakpoint, a modal above it. Both come from the same tree, so the viewer's width control is what shows the difference.",
      viewport: "phone",
      step: "ready",
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
        "A board whose schema adds custom fields, drawn by the host through the renderFeatures seam — the pair supplies the section and the gate, never the editor.",
      viewport: "phone",
      step: "features",
      render: () => (
        <Sheet
          handlers={FEATURED}
          featureDefs={[
            { slug: "effort", name: "Effort" },
            { slug: "customer", name: "Customer" },
          ]}
        />
      ),
    },
  },
});
