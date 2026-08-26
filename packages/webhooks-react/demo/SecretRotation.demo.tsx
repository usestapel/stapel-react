/**
 * Rotating a signing secret — a confirm that says the consequence out loud.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SecretRotation } from "../src/default/SecretRotation.js";
import { WebhooksDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { CREATED_WITH_SECRET, HEALTHY, NOTIFICATION_RULE } from "./_fixtures.js";

const ROTATES: DemoHandlers = {
  "/secret": CREATED_WITH_SECRET,
};

function Rotation(props: {
  delivery: string;
  id: string;
  hasSecret: boolean;
}): ReactElement {
  return (
    <WebhooksDemoHarness handlers={ROTATES}>
      <SecretRotation
        subscriptionId={props.id}
        deliveryType={props.delivery}
        hasSecret={props.hasSecret}
        docsHref="https://docs.example.com/webhooks/verify"
      />
    </WebhooksDemoHarness>
  );
}

export default defineDemo({
  id: "webhooks.secret-rotation",
  title: "Rotate signing secret",
  description:
    "There is no overlap window: the old secret stops verifying the instant the new one is issued, so every delivery to a receiver that has not been updated fails from that moment — and enough failures switch the webhook off. That is a live integration going down as the direct consequence of one click, which is what the confirm's BODY says instead of asking 'are you sure?'. For a delivery type that carries no signature at all the control is gated with that as its stated reason, beside it: the backend's answer there is a 400 nobody can act on, and a button whose only outcome is a refusal should not be offered.",
  component: SecretRotation,
  tokens: ["error", "text-muted"],
  variants: {
    default: {
      description:
        "A signed webhook: rotation is available, and the confirm names the break rather than hiding it.",
      viewport: "desktop",
      step: "signed",
      render: () => (
        <Rotation delivery={HEALTHY.delivery} id={HEALTHY.id} hasSecret />
      ),
    },
    phone: {
      description: "390px, where the confirm is a bottom sheet.",
      viewport: "phone",
      step: "signed_phone",
      render: () => (
        <Rotation delivery={HEALTHY.delivery} id={HEALTHY.id} hasSecret />
      ),
    },
    unsigned: {
      description:
        "A notification rule carries no signature, so there is nothing to rotate — the control states that instead of vanishing. A control that disappears teaches nobody the rule.",
      viewport: "desktop",
      step: "unsigned_gate",
      render: () => (
        <Rotation
          delivery={NOTIFICATION_RULE.delivery}
          id={NOTIFICATION_RULE.id}
          hasSecret={false}
        />
      ),
    },
  },
});
