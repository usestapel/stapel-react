/**
 * `BoardsPane` in the viewer — the screen a host actually mounts at `/tasks`.
 *
 * Three variants because the pane has three genuinely different answers, and
 * the whole design claim of the substrate is that they never collapse into one
 * grey rectangle: boards exist, there are none yet, or the list could not be
 * read at all.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { BoardsPane } from "../src/default/index.js";
import { boards, vocabulary } from "./fixtures.js";
import { TasksDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <TasksDemoHarness handlers={props.handlers}>
      <BoardsPane
        onOpenBoard={() => {
          // A demo has no router; the control is enabled and does nothing
          // visible, which is honest — the gate exists for hosts that pass no
          // handler at all (see the `no-navigation` variant).
        }}
      />
    </TasksDemoHarness>
  );
}

const READY: DemoHandlers = { "boards/presets": vocabulary, boards };
const EMPTY: DemoHandlers = { "boards/presets": vocabulary, boards: [] };
const FAILED: DemoHandlers = {
  "boards/presets": vocabulary,
  boards: [503, { localizable_error: "error.503.tasks_scope_unresolved" }],
};

export default defineDemo({
  id: "tasks.boards-pane",
  title: "Boards (default skin)",
  description:
    "The boards list: name, column count, creation date, an archive confirm that is a bottom sheet on a phone, and a create sheet that discovers its presets from the server.",
  component: BoardsPane,
  variants: {
    default: {
      description: "Two boards, desktop width.",
      viewport: "desktop",
      step: "ready",
      render: () => <Pane handlers={READY} />,
    },
    phone: {
      description: "The same list at 390px, where the archive question is a sheet.",
      viewport: "phone",
      step: "ready-phone",
      render: () => <Pane handlers={READY} />,
    },
    empty: {
      description:
        "No boards yet: the empty arm carries the create button, so the state is not a dead end.",
      viewport: "phone",
      step: "empty",
      render: () => <Pane handlers={EMPTY} />,
    },
    failed: {
      description:
        "The deployment cannot resolve a workspace: a refusal with a retry, never 'you have no boards'.",
      viewport: "desktop",
      step: "failed",
      render: () => <Pane handlers={FAILED} />,
    },
    "no-navigation": {
      description:
        "A host that wired no board navigation: the Open control states the reason beside itself.",
      viewport: "desktop",
      step: "gated",
      render: () => (
        <TasksDemoHarness handlers={READY}>
          <BoardsPane />
        </TasksDemoHarness>
      ),
    },
  },
});
