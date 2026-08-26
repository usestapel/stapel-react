/**
 * The channel-parametrized panel BEHIND the email and phone cards, shown on
 * its own because a host can mount it directly for either channel.
 *
 * The point it documents is the cancel: a scheduled change is days long, and
 * calling one off is a decision taken through the fleet's confirm — a bottom
 * sheet on a phone, a centred modal above the tablet breakpoint — not a
 * popover anchored to a small button that lands wherever it fits.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AuthenticatorChangePanel } from "../src/default/security/AuthenticatorChangePanel.js";
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
        <AuthenticatorChangePanel channel="email" />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.authenticator-change-skin",
  title: "Authenticator change (default skin)",
  description:
    "One implementation, either channel. Instant when the current authenticator can be proved; a scheduled change with a cooldown when it cannot — and calling that off goes through the fleet's confirm, not a popover.",
  component: AuthenticatorChangePanel,
  variants: {
    default: {
      description: "Nothing scheduled: the instant route, mounted for the email channel.",
      step: "idle",
      viewport: "phone",
      render: () => <Panel handlers={IDLE} />,
    },
    scheduled: {
      description: "A change in its cooldown, and the one control that stops it.",
      step: "pendingDelayed",
      render: () => <Panel handlers={PENDING} />,
    },
  },
});
