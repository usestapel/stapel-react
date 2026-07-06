/** Members — headless roster + invite / role / remove controls for a workspace. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { Members } from "../src/index.js";
import {
  WorkspacesDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

const DEMO_WS = "0192f000-0000-4000-8000-000000000001";

/** The roster the canned GET /{id}/members handler returns. */
const DEMO_MEMBERS = {
  members: [
    {
      id: "0192b000-0000-4000-8000-000000000001",
      workspace_id: DEMO_WS,
      user_id: "0192a000-0000-4000-8000-000000000001",
      email: "owner@example.com",
      role: "owner",
      invited_at: "2026-05-20T10:00:00Z",
      accepted_at: "2026-05-20T10:05:00Z",
      last_accessed_at: "2026-06-01T09:00:00Z",
    },
    {
      id: "0192b000-0000-4000-8000-000000000002",
      workspace_id: DEMO_WS,
      user_id: "0192a000-0000-4000-8000-000000000002",
      email: "member@example.com",
      role: "member",
      invited_at: "2026-05-21T10:00:00Z",
      accepted_at: "2026-05-21T10:05:00Z",
      last_accessed_at: null,
    },
  ],
};

function MembersBody(): ReactElement {
  return (
    <DemoCard heading="Members">
      <Members workspaceId={DEMO_WS}>
        {({ members, isLoading, isInviting, invite }) => (
          <>
            <StepBadge
              step={isLoading ? "loading" : `${members.length} member(s)`}
            />
            <DemoActions>
              <DemoButton
                run={() => {
                  invite({ emails: ["new@example.com"], role: "member" });
                }}
                labelKey={
                  isInviting
                    ? "workspaces.members.inviting"
                    : "workspaces.members.invite"
                }
              />
            </DemoActions>
          </>
        )}
      </Members>
    </DemoCard>
  );
}

function MembersDemo(): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={{ "/members": DEMO_MEMBERS }}>
      <MembersBody />
    </WorkspacesDemoHarness>
  );
}

/**
 * Demonstrates the headless member roster: the canned handler returns a
 * workspace's members for GET /{id}/members, and the invite button POSTs a new
 * invitation. Bring your own roster / invite form / role menu — the component is
 * renderless.
 */
export default defineDemo({
  id: "workspaces.members",
  title: "Members",
  description:
    "The headless Members wraps a workspace's roster plus invite / role-change / removal controls, exposing members / loading / per-action pending / error state. Bring your own UI — the component is renderless.",
  component: Members,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <MembersDemo /> },
  },
});
