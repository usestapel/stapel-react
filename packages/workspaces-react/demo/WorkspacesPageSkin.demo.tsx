/**
 * THE DEFAULT SKIN, IN THE VIEWER — the workspaces roster as it ships.
 *
 * Three states, and they are three different sentences: the account with
 * workspaces, the account with none on an installation that hands none out,
 * and the read that FAILED — which is the state the 2026-08-09 incident
 * rendered as "you have no workspaces" for hours.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { WorkspacesPage } from "../src/default/WorkspacesPage.js";
import { WorkspacesDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  WORKSPACES_PAGE_EMPTY_HANDLERS,
  WORKSPACES_PAGE_FAILED_HANDLERS,
  WORKSPACES_PAGE_HANDLERS,
} from "./skinFixtures.js";

/** Opening a workspace is the HOST's route; inside the viewer it would
 * navigate the frame away from the story, so the demo swallows it. */
function stay(): void {
  return undefined;
}

function Page(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={props.handlers}>
      <WorkspacesPage onOpen={stay} />
    </WorkspacesDemoHarness>
  );
}

export default defineDemo({
  id: "workspaces.workspaces-page",
  title: "Workspaces page (default skin)",
  description:
    "The shipped roster: every workspace the caller belongs to with its owner and member count, the home workspace set and cleared in place, and a create control gated on the installation's policy — with the reason printed beside it rather than the button silently missing.",
  component: WorkspacesPage,
  // The roster screen IS the product surface of the headless list and of
  // the provider that feeds it — both are mounted by this story.
  covers: ["WorkspaceList", "WorkspacesProvider"],
  variants: {
    default: {
      description:
        "Two workspaces, one of them home, on an installation that lets people create more.",
      step: "ready",
      render: () => <Page handlers={WORKSPACES_PAGE_HANDLERS} />,
    },
    empty: {
      description:
        "Nobody has invited this person anywhere, and the installation hands out no workspaces — so the empty state says who to ask instead of offering a button that would be refused.",
      step: "empty",
      viewport: "phone",
      render: () => <Page handlers={WORKSPACES_PAGE_EMPTY_HANDLERS} />,
    },
    failed: {
      description:
        "The list read fails. 'We could not load your workspaces' with a retry — never 'you have none'.",
      step: "failed",
      render: () => <Page handlers={WORKSPACES_PAGE_FAILED_HANDLERS} />,
    },
  },
});
