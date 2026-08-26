/**
 * Changing the email address on the account.
 *
 * Two strategies live behind one card, and which one a person gets is the
 * backend's decision, not a preference: prove the OLD address and swap
 * immediately, or — when the old address is out of reach — start a scheduled
 * change with a cooldown, during which the card becomes the banner that says
 * when it lands and how to call it off.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { EmailChangePanel } from "../src/default/security/EmailChangePanel.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CAPABILITIES,
  ME,
  NO_DELAYED_CHANGE,
  PENDING_DELAYED_CHANGE,
} from "./fixtures.js";

const IDLE: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/me/": ME,
  "/email/change/delayed/status/": NO_DELAYED_CHANGE,
};

const PENDING: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/me/": ME,
  "/email/change/delayed/status/": PENDING_DELAYED_CHANGE,
};

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <EmailChangePanel />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.email-change-skin",
  title: "Change email (default skin)",
  description:
    "The email half of the authenticator-change surface: prove the current address and swap now, or start the scheduled change when you cannot reach it any more.",
  component: EmailChangePanel,
  variants: {
    default: {
      description: "The instant route: prove the address you have, then name the new one.",
      step: "idle",
      viewport: "phone",
      render: () => <Panel handlers={IDLE} />,
    },
    scheduled: {
      description:
        "A scheduled change is 6 days out. The card is the banner: what is coming, when, and the one way to stop it.",
      step: "pendingDelayed",
      render: () => <Panel handlers={PENDING} />,
    },
  },
});
