/**
 * THE DEFAULT SKIN, IN THE VIEWER — the public `/invite/{token}` page as it
 * ships. The one screen in this pair a person meets before they have an
 * account, so all three variants matter equally.
 *
 * The address is never shown whole: the preview carries a MASKED email
 * (harvest-proof), and the routing between "this is your invitation" and
 * "this is somebody else's" is done by masking the session's own address with
 * the backend's algorithm and comparing the two masks.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { InviteAcceptPage } from "../src/default/InviteAcceptPage.js";
import { WorkspacesDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  INVITE_EXPIRED_HANDLERS,
  INVITE_HANDLERS,
  INVITE_OTHER_SESSION_EMAIL,
  INVITE_SESSION_EMAIL,
  INVITE_TOKEN,
} from "./skinFixtures.js";

function Invite(props: {
  handlers: DemoHandlers;
  sessionEmail: string | null;
}): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={props.handlers}>
      <InviteAcceptPage token={INVITE_TOKEN} sessionEmail={props.sessionEmail} />
    </WorkspacesDemoHarness>
  );
}

export default defineDemo({
  id: "workspaces.invite-accept-page",
  title: "Invitation page (default skin)",
  description:
    "The shipped /invite/{token} screen: the workspace and the role being offered, one primary action per block (Join is the primary; Decline is a danger link behind a confirm that states what it costs), the wrong-account branch with a switch CTA, and the terminal states — expired, revoked, already used — as sentences rather than an error box.",
  component: InviteAcceptPage,
  variants: {
    default: {
      description:
        "The signed-in account is the invited one: the join prompt, with decline behind a confirm.",
      step: "acceptPrompt",
      render: () => (
        <Invite handlers={INVITE_HANDLERS} sessionEmail={INVITE_SESSION_EMAIL} />
      ),
    },
    "wrong-account": {
      description:
        "Signed in as somebody else. The page says whose invitation it is (masked) and offers the switch — it never silently accepts on the wrong account.",
      step: "wrongAccount",
      viewport: "phone",
      render: () => (
        <Invite
          handlers={INVITE_HANDLERS}
          sessionEmail={INVITE_OTHER_SESSION_EMAIL}
        />
      ),
    },
    expired: {
      description:
        "The link outlived its TTL: one sentence saying so and what to do, no dead Join button.",
      step: "unavailable",
      render: () => (
        <Invite
          handlers={INVITE_EXPIRED_HANDLERS}
          sessionEmail={INVITE_SESSION_EMAIL}
        />
      ),
    },
  },
});
