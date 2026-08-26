/**
 * Writing a rule: the picker that reads the deployment, and the refusals the
 * browser answers before the server has to.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SubscriptionSheet } from "../src/default/SubscriptionSheet.js";
import type { Subscription } from "../src/api/types.js";
import { WebhooksDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CATALOG,
  HEALTHY,
  NOTIFICATION_RULE,
  SUBSCRIPTION_CAP,
} from "./_fixtures.js";

const OPEN: DemoHandlers = {
  "/event-catalog": CATALOG,
  "/subscriptions": [],
};

/** The one create refusal a client cannot predict. */
const AT_CAP: DemoHandlers = {
  "/event-catalog": CATALOG,
  "/subscriptions": SUBSCRIPTION_CAP,
};

/**
 * A rule whose stored predicate uses an operator this client does not run —
 * what a person sees the instant they paste one in, and the reason the filter
 * grammar is ported to the browser at all.
 */
const BAD_FILTER: Subscription = {
  ...HEALTHY,
  filter: { city: { $regex: "^Ber" } },
};

function Sheet(props: {
  handlers: DemoHandlers;
  subscription?: Subscription;
}): ReactElement {
  return (
    <WebhooksDemoHarness handlers={props.handlers}>
      <SubscriptionSheet
        open
        onClose={() => undefined}
        docsHref="https://docs.example.com/webhooks/verify"
        {...(props.subscription !== undefined
          ? { subscription: props.subscription }
          : {})}
      />
    </WebhooksDemoHarness>
  );
}

export default defineDemo({
  id: "webhooks.subscription-sheet",
  title: "New webhook",
  description:
    "A bottom sheet on a phone and a modal above 768px, because it is the same dialog either way. The event list comes from `GET event-catalog` — generated from the modules actually installed here — so the picker can never offer an event nothing emits or hide one a host's own module does. Everything decidable in the browser is decided in the browser: a missing target key, an http:// URL, a predicate outside the grammar. The backend answers each of those with a single code that names no position, so the sheet answers them beside the field instead.",
  component: SubscriptionSheet,
  tokens: ["surface-raised", "error"],
  variants: {
    default: {
      description:
        "A fresh webhook: pick the event, pick the delivery, fill the destination. The submit states its own reason for being unavailable rather than sitting grey.",
      viewport: "desktop",
      step: "empty_form",
      render: () => <Sheet handlers={OPEN} />,
    },
    phone: {
      description: "The same form as a bottom sheet at 390px.",
      viewport: "phone",
      step: "sheet",
      render: () => <Sheet handlers={OPEN} />,
    },
    notification: {
      description:
        "A delivery type with a different target shape entirely: a notification needs a type AND at least one recipient, and the backend refuses one that addresses nobody at subscription time rather than at delivery time — so the form does too.",
      viewport: "desktop",
      step: "notification_target",
      render: () => <Sheet handlers={OPEN} subscription={NOTIFICATION_RULE} />,
    },
    "invalid-filter": {
      description:
        "`$regex` is not an operator this module runs — deliberately: a predicate is evaluated once per matching event inside the dispatcher, and a regex there is a backtracking lever pointed at every other subscriber. The sentence names the operator and the path, which is exactly what the backend's single `invalid_filter` code cannot.",
      viewport: "desktop",
      step: "filter_refused",
      render: () => <Sheet handlers={OPEN} subscription={BAD_FILTER} />,
    },
    "at-cap": {
      description:
        "The refusal the browser cannot predict: you are at the per-owner ceiling. Nothing to retry — something has to be deleted first — so it arrives as a named server refusal rather than a validation hint.",
      viewport: "phone",
      step: "cap_409",
      render: () => <Sheet handlers={AT_CAP} />,
    },
  },
});
