/**
 * THE DEFAULT SKIN, IN THE VIEWER — the roster as it ships.
 *
 * The `default` variant is the one worth looking at twice: the top row is the
 * VIEWER's own (`MemberResponse.is_self`, stapel-workspaces 0.30.0), so both
 * controls the server refuses on that row — "Remove" and "Reset password" —
 * are switched off with the reason printed beside them. Without that field
 * the screen either guesses (and greys out somebody else's row) or offers a
 * button whose 404 reads as "this member has been removed".
 *
 * `no-workspace` is the state the NAV contract makes reachable: the screen is
 * mounted from a manifest with no active workspace in the runtime, and it
 * draws a chooser instead of a blank page.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MembersManager } from "../src/default/MembersManager.js";
import { WorkspacesDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_WS, MEMBERS_EMPTY_HANDLERS, MEMBERS_HANDLERS } from "./skinFixtures.js";

function Roster(props: {
  handlers: DemoHandlers;
  canManage?: boolean;
}): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={props.handlers}>
      <MembersManager
        workspaceId={DEMO_WS}
        {...(props.canManage !== undefined ? { canManage: props.canManage } : {})}
      />
    </WorkspacesDemoHarness>
  );
}

export default defineDemo({
  id: "workspaces.members-manager",
  title: "Members (default skin)",
  description:
    "The shipped roster: who is here, the role each one holds (from the effective registry, not a hardcoded four), the three states of two-factor evidence, an invite, a rename, an administrative password reset and a removal — each switched off with the server's reason where the server would refuse it, including on the viewer's own row.",
  component: MembersManager,
  variants: {
    default: {
      description:
        "Four kinds of row: the viewer's own (both self-refused controls off), a suspended admin missing a second factor, a provisioned member nobody has checked yet, and the overlay role a deployment added.",
      step: "roster",
      render: () => <Roster handlers={MEMBERS_HANDLERS} />,
    },
    "read-only": {
      description:
        "A caller who may look and not touch: the controls are gone and the screen SAYS so, rather than silently rendering a shorter row.",
      step: "read-only",
      viewport: "phone",
      render: () => <Roster handlers={MEMBERS_HANDLERS} canManage={false} />,
    },
    empty: {
      description: "A workspace with nobody in it yet — with the invite door in the empty state.",
      step: "empty",
      render: () => <Roster handlers={MEMBERS_EMPTY_HANDLERS} />,
    },
    "no-workspace": {
      description:
        "Mounted from the nav manifest with no active workspace resolved: a designed chooser, never a blank screen.",
      step: "choose-workspace",
      viewport: "phone",
      render: () => (
        <WorkspacesDemoHarness handlers={MEMBERS_HANDLERS}>
          <MembersManager />
        </WorkspacesDemoHarness>
      ),
    },
  },
});
