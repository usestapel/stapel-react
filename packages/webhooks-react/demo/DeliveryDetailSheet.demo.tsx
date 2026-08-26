/**
 * One delivery in full: what we sent, what we sent it with, what came back.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DeliveryDetailSheet } from "../src/default/DeliveryDetailSheet.js";
import { WebhooksDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DELIVERY_DEAD, DELIVERY_SUCCEEDED, HEALTHY } from "./_fixtures.js";

const OF_DEAD: DemoHandlers = {
  "/deliveries": DELIVERY_DEAD,
};

const OF_SUCCEEDED: DemoHandlers = {
  "/deliveries": DELIVERY_SUCCEEDED,
};

function Detail(props: {
  handlers: DemoHandlers;
  deliveryId: string;
}): ReactElement {
  return (
    <WebhooksDemoHarness handlers={props.handlers}>
      <DeliveryDetailSheet
        open
        onClose={() => undefined}
        subscriptionId={HEALTHY.id}
        deliveryId={props.deliveryId}
      />
    </WebhooksDemoHarness>
  );
}

export default defineDemo({
  id: "webhooks.delivery-detail",
  title: "Delivery detail",
  description:
    "The envelope and the headers are REBUILT from the stored event, and the sheet says so above them. The module keeps the matched payload and the identifiers; the transport assembles the envelope at send time from exactly those fields, so this is what a replay would send rather than a recording of the original request — and a screen that implied otherwise would send somebody hunting for a difference that is an artefact of the reconstruction. The signature line is deliberately absent: it is an HMAC over the body with a secret this client does not hold, and a fabricated one would be the single most misleading row on the page.",
  component: DeliveryDetailSheet,
  tokens: ["error", "surface-raised"],
  variants: {
    default: {
      description:
        "A dead letter: six attempts, no response status at all, the connect timeout kept whole, and the replay this row is the only kind that accepts.",
      viewport: "desktop",
      step: "dead",
      render: () => <Detail handlers={OF_DEAD} deliveryId={DELIVERY_DEAD.id} />,
    },
    phone: {
      description:
        "390px as a bottom sheet. The JSON blocks scroll inside themselves — one long URL in a payload must never widen the page.",
      viewport: "phone",
      step: "dead_phone",
      render: () => <Detail handlers={OF_DEAD} deliveryId={DELIVERY_DEAD.id} />,
    },
    succeeded: {
      description:
        "A delivery that worked: 200, one attempt, nothing to replay — and the replay control says why rather than disappearing.",
      viewport: "desktop",
      step: "succeeded",
      render: () => (
        <Detail handlers={OF_SUCCEEDED} deliveryId={DELIVERY_SUCCEEDED.id} />
      ),
    },
  },
});
