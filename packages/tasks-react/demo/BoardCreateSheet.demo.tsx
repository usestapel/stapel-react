/**
 * `BoardCreateSheet` in the viewer.
 *
 * The `scope-blocked` variant renders the one refusal this form has to own:
 * `error.503.tasks_scope_unresolved` is not "try again later", it is "pick a
 * workspace", and the sheet says the second sentence rather than the generic
 * one core's dialect would produce for a 503.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { StapelApiError } from "@stapel/core";
import { BoardCreateSheet } from "../src/default/index.js";
import { vocabulary } from "./fixtures.js";
import { TasksDemoHarness } from "./_harness.js";

const SCOPE_ERROR = new StapelApiError({
  code: "error.503.tasks_scope_unresolved",
  message: "Cannot determine which workspace this board belongs to",
  status: 503,
});

function Sheet(props: { error?: unknown }): ReactElement {
  return (
    <TasksDemoHarness handlers={{ "boards/presets": vocabulary }}>
      <BoardCreateSheet
        open
        onClose={() => {
          // A demo keeps the sheet open.
        }}
        onCreate={() => Promise.resolve(null)}
        {...(props.error !== undefined ? { error: props.error } : {})}
      />
    </TasksDemoHarness>
  );
}

export default defineDemo({
  id: "tasks.board-create-sheet",
  title: "Board create sheet (default skin)",
  description:
    "Name plus a shape: the preset list is the server's own vocabulary, and 'custom columns' switches to an explicit column editor whose keys are slugged from the names.",
  component: BoardCreateSheet,
  variants: {
    default: {
      description: "Desktop modal, presets discovered from GET boards/presets.",
      viewport: "desktop",
      step: "idle",
      render: () => <Sheet />,
    },
    phone: {
      description: "390px: the same form as a bottom sheet.",
      viewport: "phone",
      step: "idle-phone",
      render: () => <Sheet />,
    },
    "scope-blocked": {
      description:
        "The deployment could not resolve a workspace: the refusal names the action that fixes it.",
      viewport: "phone",
      step: "refused",
      render: () => <Sheet error={SCOPE_ERROR} />,
    },
  },
});
