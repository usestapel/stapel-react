/**
 * `ColumnManager` in the viewer.
 *
 * The `duplicate` variant is the reason this screen exists in this shape:
 * adding a column whose key the board already has used to be a 500 — a server
 * fault reported for ordinary typing. Backend 0.3.0 answers
 * `409 error.409.tasks_column_exists`, and the manager renders that refusal's
 * own translated sentence plus the one thing the sentence cannot say: what to
 * do about it.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { StapelApiError, actionAvailable, loadReady } from "@stapel/core";
import { ColumnManager } from "../src/default/index.js";
import { columns } from "./fixtures.js";
import { TasksDemoHarness } from "./_harness.js";

const DUPLICATE = new StapelApiError({
  code: "error.409.tasks_column_exists",
  message: "A column with this key already exists on the board",
  status: 409,
});

function Manager(props: { error?: unknown }): ReactElement {
  return (
    <TasksDemoHarness>
      <ColumnManager
        columns={loadReady(columns)}
        onReorder={() => Promise.resolve()}
        addColumn={actionAvailable()}
        onAddColumn={() => Promise.resolve()}
        {...(props.error !== undefined ? { addError: props.error } : {})}
      />
    </TasksDemoHarness>
  );
}

export default defineDemo({
  id: "tasks.column-manager",
  title: "Column manager (default skin)",
  description:
    "Drag the columns into order (keyboard sensor included) and add one. Renaming and deleting are not in this API, so the screen explains their absence instead of drawing two controls that cannot work.",
  component: ColumnManager,
  variants: {
    default: {
      description: "Three columns, desktop width.",
      viewport: "desktop",
      step: "ready",
      render: () => <Manager />,
    },
    phone: {
      description: "390px: the same list, thumb-sized handles.",
      viewport: "phone",
      step: "ready-phone",
      render: () => <Manager />,
    },
    duplicate: {
      description:
        "The key is already on the board: a named 409, with the fix beside it.",
      viewport: "phone",
      step: "refused",
      render: () => <Manager error={DUPLICATE} />,
    },
  },
});
