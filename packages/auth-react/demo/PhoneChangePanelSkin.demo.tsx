/**
 * Changing the phone number on the account — the same machine as the email
 * panel, parametrized by channel, which is why both read as one product
 * rather than two screens that happen to be near each other.
 *
 * The phone variant matters on its own: the code length differs per channel
 * (the backend states it in `capabilities.otp`), and this is the surface most
 * likely to be used on the very device whose number is changing.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PhoneChangePanel } from "../src/default/security/PhoneChangePanel.js";
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
  "/phone/change/delayed/status/": NO_DELAYED_CHANGE,
};

const PENDING: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/me/": ME,
  "/phone/change/delayed/status/": PENDING_DELAYED_CHANGE,
};

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <PhoneChangePanel />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.phone-change-skin",
  title: "Change phone (default skin)",
  description:
    "The phone half of the authenticator-change surface. Same machine as email, different channel — the code length comes from the deployment, never from a constant in the skin.",
  component: PhoneChangePanel,
  variants: {
    default: {
      description: "Prove the current number, then name the new one.",
      step: "idle",
      viewport: "phone",
      render: () => <Panel handlers={IDLE} />,
    },
    scheduled: {
      description: "A scheduled swap already running, with its cooldown and its way out.",
      step: "pendingDelayed",
      render: () => <Panel handlers={PENDING} />,
    },
  },
});
