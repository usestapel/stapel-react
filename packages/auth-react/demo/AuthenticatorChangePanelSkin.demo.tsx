/**
 * The channel-parametrized panel BEHIND the email and phone cards — shown as
 * what it actually is: ONE implementation, mounted twice.
 *
 * This story used to mount `channel="email"` alone, which made it a
 * pixel-for-pixel copy of the email card's own story (visual pass N2: the
 * shot claimed to be the authenticator panel and showed the email panel). A
 * component whose whole claim is "either channel, one machine" has to be
 * photographed with both channels on screen, or the claim has no evidence.
 *
 * The second thing it documents is the cancel: a scheduled change is days
 * long, and calling one off is a decision taken through the fleet's confirm —
 * a bottom sheet on a phone, a centred modal above the tablet breakpoint —
 * not a popover anchored to a small button that lands wherever it fits.
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { defineDemo } from "@stapel/showcase";
import { AuthenticatorChangePanel } from "../src/default/security/AuthenticatorChangePanel.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CAPABILITIES,
  ME,
  NO_DELAYED_CHANGE,
  PENDING_DELAYED_CHANGE_PHONE,
} from "./fixtures.js";

const IDLE: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/me/": ME,
  "/email/change/delayed/status/": NO_DELAYED_CHANGE,
  "/phone/change/delayed/status/": NO_DELAYED_CHANGE,
};

const PHONE_PENDING: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/me/": ME,
  "/email/change/delayed/status/": NO_DELAYED_CHANGE,
  "/phone/change/delayed/status/": PENDING_DELAYED_CHANGE_PHONE,
};

function Both(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <Flex vertical gap="middle" style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <AuthenticatorChangePanel channel="email" />
        <AuthenticatorChangePanel channel="phone" />
      </Flex>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.authenticator-change-skin",
  title: "Authenticator change (default skin)",
  description:
    "One implementation, either channel — mounted twice so the sameness is visible. Instant when the current authenticator can be proved; a scheduled change with a cooldown when it cannot, and calling that off goes through the fleet's confirm, not a popover.",
  component: AuthenticatorChangePanel,
  covers: ["AuthenticatorChange"],
  variants: {
    default: {
      description:
        "Nothing scheduled on either channel: the same card, the same instant route, two different contacts.",
      step: "idle",
      viewport: "phone",
      render: () => <Both handlers={IDLE} />,
    },
    scheduled: {
      description:
        "The phone half is mid-cooldown while the email half is untouched — the pending banner replaces the change UI for that channel only, and takes the one control that stops it with it.",
      step: "pendingDelayed",
      render: () => <Both handlers={PHONE_PENDING} />,
    },
  },
});
