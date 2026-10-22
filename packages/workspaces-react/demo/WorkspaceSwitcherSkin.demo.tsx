/**
 * The top-bar switcher over the active workspace — the `workspaces.switcher`
 * embed. Two states, because they are two different sentences: the list is
 * there and one workspace is active, or the read FAILED and the control says
 * so with a retry instead of drawing an empty select.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { WorkspaceSwitcher } from "../src/default/WorkspaceSwitcher.js";
import { WorkspaceSelectionProvider } from "../src/model/selection.js";
import { WorkspacesDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  WORKSPACES_PAGE_FAILED_HANDLERS,
  WORKSPACES_PAGE_HANDLERS,
} from "./skinFixtures.js";

function Switcher(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={props.handlers}>
      <WorkspaceSelectionProvider repository={null}>
        <WorkspaceSwitcher />
      </WorkspaceSelectionProvider>
    </WorkspacesDemoHarness>
  );
}

export default defineDemo({
  id: "workspaces.switcher-skin",
  title: "Workspace switcher (default skin)",
  description:
    "The top-bar control over the one workspace selection every workspace screen reads: the active workspace and the others to switch to, or a retry when the list could not be read.",
  component: WorkspaceSwitcher,
  tokens: ["text", "surface", "danger"],
  variants: {
    default: {
      description: "Two workspaces; the preferred one is active.",
      step: "ready",
      viewport: "phone",
      render: () => <Switcher handlers={WORKSPACES_PAGE_HANDLERS} />,
    },
    failed: {
      description:
        "The list read failed: a retry naming the failure, never an empty select that reads as no workspaces.",
      step: "failed",
      render: () => <Switcher handlers={WORKSPACES_PAGE_FAILED_HANDLERS} />,
    },
  },
});
