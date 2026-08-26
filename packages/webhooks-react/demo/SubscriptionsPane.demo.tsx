/**
 * The list of rules — and the two failures it has to tell apart.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SubscriptionsPane } from "../src/default/SubscriptionsPane.js";
import { WebhooksDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  AUTO_DISABLED,
  CATALOG,
  HEALTHY,
  MANDATE_UNAVAILABLE,
  NOTIFICATION_RULE,
} from "./_fixtures.js";

const LIST: DemoHandlers = {
  "/event-catalog": CATALOG,
  "/subscriptions": [HEALTHY, NOTIFICATION_RULE, AUTO_DISABLED],
};

const DISABLED_ONLY: DemoHandlers = {
  "/event-catalog": CATALOG,
  "/subscriptions": [AUTO_DISABLED],
};

/** The refusal that is about the DEPLOYMENT, not the person. */
const MANDATE: DemoHandlers = {
  "/event-catalog": CATALOG,
  "/subscriptions": MANDATE_UNAVAILABLE,
};

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <WebhooksDemoHarness handlers={props.handlers}>
      <SubscriptionsPane />
    </WebhooksDemoHarness>
  );
}

export default defineDemo({
  id: "webhooks.subscriptions",
  title: "Webhook rules",
  description:
    "Event, delivery, destination, on/off, failures. The destination is a SUMMARY — the host of a URL, the recipient of a notification — because the full target is unreadable at list width and one row-open away in the sheet. The switch carries its own copy: re-activating a rule resets its failure counter server-side, so the person is told it gets the full run of retries again rather than one more attempt.",
  component: SubscriptionsPane,
  tokens: ["surface-raised", "error", "warning"],
  variants: {
    default: {
      description: "Three rules, one of them already switched off by the backend.",
      viewport: "desktop",
      step: "ready",
      render: () => <Pane handlers={LIST} />,
    },
    phone: {
      description:
        "390px: cards, not a table with a horizontal scrollbar over the one screen somebody opens on their phone to turn a broken integration off.",
      viewport: "phone",
      step: "cards",
      render: () => <Pane handlers={DISABLED_ONLY} />,
    },
    "auto-disabled": {
      description:
        "The row that needs a person: `disabled_at` is set, so the backend switched it off after repeated dead letters — not somebody's own decision. The threshold is a deployment setting the API does not serve, so the copy says 'after repeated failures' instead of inventing a number.",
      viewport: "desktop",
      step: "auto_disabled",
      render: () => <Pane handlers={DISABLED_ONLY} />,
    },
    "mandate-unavailable": {
      description:
        "Every route of this module is mandate-scoped and can answer 503 `mandate_unavailable`. Drawn as an ordinary red failure it would tell a developer their integration settings are broken; it is named instead, in the only voice that fits — this is on our side, it is temporary, here is the retry.",
      viewport: "phone",
      step: "mandate_503",
      render: () => <Pane handlers={MANDATE} />,
    },
  },
});
