/**
 * The delivery log — where "it did not arrive" gets an answer.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DeliveriesPane } from "../src/default/DeliveriesPane.js";
import { WebhooksDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DELIVERY_DEAD,
  DELIVERY_RETRYING,
  DELIVERY_SUCCEEDED,
  HEALTHY,
} from "./_fixtures.js";

const MIXED: DemoHandlers = {
  "/deliveries": [DELIVERY_RETRYING, DELIVERY_SUCCEEDED],
};

const DEAD: DemoHandlers = {
  "/deliveries": [DELIVERY_DEAD],
};

const EMPTY: DemoHandlers = {
  "/deliveries": [],
};

function Log(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <WebhooksDemoHarness handlers={props.handlers}>
      <DeliveriesPane subscriptionId={HEALTHY.id} />
    </WebhooksDemoHarness>
  );
}

export default defineDemo({
  id: "webhooks.deliveries",
  title: "Delivery log",
  description:
    "The retention line at the top is load-bearing: successful rows are swept after a week and dead letters after ninety days, and without that sentence 'my delivery disappeared' is indistinguishable from 'my delivery was never recorded'. Replay is on every row and refused with a reason on every row that is not a dead letter — the backend answers 409 for anything else, and a button that appears and disappears per row teaches nobody the rule. There is no stream anywhere in this module, so while something is still in flight the log re-reads every fifteen seconds and says so, rather than changing silently under somebody's cursor.",
  component: DeliveriesPane,
  tokens: ["success", "error", "warning", "text-muted"],
  variants: {
    default: {
      description:
        "One delivered, one on its retry ladder — the poll is running and the log admits it.",
      viewport: "desktop",
      step: "mixed",
      render: () => <Log handlers={MIXED} />,
    },
    phone: {
      description:
        "390px: cards with the status, the attempt count and the last error, and the two controls under them.",
      viewport: "phone",
      step: "cards",
      render: () => <Log handlers={MIXED} />,
    },
    "dead-letter": {
      description:
        "The only status a replay accepts. Six attempts, no response at all, and the transport error kept verbatim — a truncated timeout message is the one thing on this screen that cannot be reconstructed from anywhere else.",
      viewport: "desktop",
      step: "dead",
      render: () => <Log handlers={DEAD} />,
    },
    empty: {
      description:
        "Nothing has matched this rule yet — said out loud, with the retention note still visible so the emptiness is not read as a sweep.",
      viewport: "phone",
      step: "empty",
      render: () => <Log handlers={EMPTY} />,
    },
  },
});
