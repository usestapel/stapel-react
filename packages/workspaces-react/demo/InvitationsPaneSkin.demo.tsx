/**
 * THE DEFAULT SKIN, IN THE VIEWER — the invitations console as it ships.
 *
 * The `terminal` variant is the one that documents the gating rule: revoke
 * and rename need a live row, resend also accepts an expired one (reviving a
 * dead TTL is what it is mostly for), and every other state is refused by the
 * backend — so the controls are off with the reason the endpoint would have
 * given, instead of a button that leads to a 400.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { InvitationsPane } from "../src/default/InvitationsPane.js";
import { WorkspacesDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_WS,
  INVITATIONS_EMPTY_HANDLERS,
  INVITATIONS_HANDLERS,
  INVITATIONS_TERMINAL_HANDLERS,
} from "./skinFixtures.js";

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={props.handlers}>
      <InvitationsPane workspaceId={DEMO_WS} />
    </WorkspacesDemoHarness>
  );
}

export default defineDemo({
  id: "workspaces.invitations-pane",
  title: "Invitations (default skin)",
  description:
    "The shipped invitation console: who has been invited and has not joined, filtered by what became of the invitation, searchable by address, with revoke / resend / rename each gated on the invitation's own state — and a confirm that says a resend rotates the token, so the earlier link stops working.",
  component: InvitationsPane,
  variants: {
    default: {
      description: "Two waiting invitations, one of them never sent a letter yet.",
      step: "pending",
      render: () => <Pane handlers={INVITATIONS_HANDLERS} />,
    },
    terminal: {
      description:
        "Expired, accepted and revoked rows: resend is still offered on the expired one, everything else is off with the endpoint's own reason.",
      step: "terminal",
      viewport: "phone",
      render: () => <Pane handlers={INVITATIONS_TERMINAL_HANDLERS} />,
    },
    empty: {
      description: "Nobody is waiting — the state an admin wants to see.",
      step: "empty",
      render: () => <Pane handlers={INVITATIONS_EMPTY_HANDLERS} />,
    },
  },
});
