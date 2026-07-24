/** InviteAcceptFlow — the /invite/{token} journey (org-program §B4). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { InviteAcceptFlow } from "../src/index.js";
import {
  WorkspacesDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

const TOKEN = "demo-invite-token";

/** Pending invite for a NOT-yet-registered email — the claim path. */
const PREVIEW_NEW_USER = {
  workspace_name: "Acme Engineering",
  role: "member",
  email_masked: "m***@e***.com",
  status: "pending",
  email_registered: false,
  expires_at: "2026-07-31T10:00:00Z",
};

const CLAIM = { grant_token: "demo-grant-token" };

const MEMBER = {
  id: "0192b000-0000-4000-8000-000000000003",
  workspace_id: "0192f000-0000-4000-8000-000000000001",
  user_id: "0192a000-0000-4000-8000-000000000003",
  email: "invitee@example.com",
  role: "member",
  invited_at: "2026-06-01T10:00:00Z",
  accepted_at: "2026-06-02T10:00:00Z",
  last_accessed_at: null,
};

function InviteAcceptDemo(): ReactElement {
  return (
    <WorkspacesDemoHarness
      handlers={{
        [`/invitations/${TOKEN}/claim`]: CLAIM,
        "/invitations/accept": MEMBER,
        [`/invitations/${TOKEN}`]: PREVIEW_NEW_USER,
      }}
    >
      <DemoCard heading="InviteAcceptFlow">
        <InviteAcceptFlow token={TOKEN} sessionEmail={null}>
          {(bag) => (
            <>
              <StepBadge step={bag.state.step} />
              <DemoActions>
                <DemoButton run={() => bag.claim()} labelKey="demo.action.claim" />
                <DemoButton
                  run={() => bag.grantExchanged()}
                  labelKey="demo.action.exchange"
                />
                <DemoButton
                  run={() => bag.completeBasicData()}
                  labelKey="demo.action.continue"
                />
                <DemoButton run={() => bag.accept()} labelKey="demo.action.accept" />
                <DemoButton
                  run={() => bag.decline()}
                  labelKey="demo.action.decline"
                />
              </DemoActions>
            </>
          )}
        </InviteAcceptFlow>
      </DemoCard>
    </WorkspacesDemoHarness>
  );
}

/**
 * Demonstrates the new-user branch of the §B4 flow machine: the pending
 * preview (email_registered=false) routes to `newUser`; claim mints the login
 * grant (handed OUT via onLoginGrant — the host exchanges it at auth, the
 * pairs stay decoupled); `grantExchanged` → the basic-data step →
 * `completeBasicData` → the accept prompt → accept/decline.
 */
export default defineDemo({
  id: "workspaces.invite-accept",
  title: "Invite accept flow",
  description:
    "The headless InviteAcceptFlow drives the /invite/{token} journey: public preview routing (accept prompt / wrong account / login / claim), the grant_token hand-off seam to auth (onLoginGrant), the basic-data slot, and accept/decline. Every screen is the host's; InviteAcceptPage is the reference skin.",
  component: InviteAcceptFlow,
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <InviteAcceptDemo /> },
  },
});
