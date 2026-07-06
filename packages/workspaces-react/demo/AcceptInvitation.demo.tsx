/** AcceptInvitation — headless "join a workspace by token" action. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { AcceptInvitation } from "../src/index.js";
import {
  WorkspacesDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

/** The membership the canned POST /invitations/accept handler returns. */
const DEMO_MEMBER = {
  id: "0192b000-0000-4000-8000-000000000003",
  workspace_id: "0192f000-0000-4000-8000-000000000001",
  user_id: "0192a000-0000-4000-8000-000000000003",
  email: "invitee@example.com",
  role: "member",
  invited_at: "2026-06-01T10:00:00Z",
  accepted_at: "2026-06-02T10:00:00Z",
  last_accessed_at: null,
};

function AcceptBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="AcceptInvitation">
      <AcceptInvitation>
        {({ accept, isAccepting, isAccepted }) => (
          <>
            <StepBadge step={isAccepted ? "accepted" : "pending"} />
            {isAccepted ? (
              <span style={{ color: cssVar("color-text-secondary") }}>
                {t("workspaces.accept.accepted")}
              </span>
            ) : null}
            <DemoActions>
              <DemoButton
                run={() => {
                  accept("demo-invite-token");
                }}
                labelKey={
                  isAccepting
                    ? "workspaces.accept.accepting"
                    : "workspaces.accept.accept"
                }
              />
            </DemoActions>
          </>
        )}
      </AcceptInvitation>
    </DemoCard>
  );
}

function AcceptInvitationDemo(): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={{ "/invitations/accept": DEMO_MEMBER }}>
      <AcceptBody />
    </WorkspacesDemoHarness>
  );
}

/**
 * Demonstrates the headless invitation-accept action: the canned handler accepts
 * the token for POST /invitations/accept and returns the caller's new
 * membership, flipping the bag into its `isAccepted` state. Bring your own
 * accept button / status — the component is renderless.
 */
export default defineDemo({
  id: "workspaces.accept",
  title: "Accept invitation",
  description:
    "The headless AcceptInvitation wraps joining a workspace by its email-link token, exposing accept() plus accepting / accepted / error state (a dead token surfaces a localizable StapelApiError). Bring your own UI — the component is renderless.",
  component: AcceptInvitation,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <AcceptInvitationDemo /> },
  },
});
