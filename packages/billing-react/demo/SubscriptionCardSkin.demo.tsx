/**
 * The subscription card — the §54 default skin the `Subscription` headless
 * bag never had.
 *
 * The old story showed a `pro · active` chip beside the word "Active", with
 * "Cancel subscription" as a solid primary sitting FIRST. Here the primary is
 * "Manage billing", the way out is a quiet danger link at the bottom, and it
 * opens `SkinConfirm` — a bottom sheet under 768px, a modal above it — whose
 * body says what survives cancelling. Press it in the `active` variant to see
 * that dialog.
 *
 * Four states, four different screens: a live plan, no paid plan at all
 * (stapel-billing hands every caller a `free` row, which is NOT a
 * subscription a person bought), a bounced payment, and one already
 * cancelled — where "Runs until" replaces "Renews on" and cancelling again is
 * switched off with its reason stated.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SubscriptionCard } from "../src/default/SubscriptionCard.js";
import { BillingDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  SUBSCRIPTION_ACTIVE_HANDLERS,
  SUBSCRIPTION_CANCELLED_HANDLERS,
  SUBSCRIPTION_FREE_HANDLERS,
  SUBSCRIPTION_PAST_DUE_HANDLERS,
} from "./fixtures.js";

/** The portal redirect would navigate the viewer's frame away. */
function stay(): void {
  return undefined;
}

function Card(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <BillingDemoHarness handlers={props.handlers}>
      <SubscriptionCard onPortalUrl={stay} />
    </BillingDemoHarness>
  );
}

export default defineDemo({
  id: "billing.subscription-card",
  title: "Subscription (default skin)",
  description:
    "Plan, status and the next date, with 'Manage billing' as the primary and 'Cancel subscription' last, quiet, and behind a confirmation that says what cancelling keeps.",
  component: SubscriptionCard,
  variants: {
    active: {
      description:
        "A live Team plan renewing on 1 September. Press Cancel to open the sheet.",
      step: "active",
      viewport: "phone",
      render: () => <Card handlers={SUBSCRIPTION_ACTIVE_HANDLERS} />,
    },
    free: {
      description:
        "The auto-created free row: no paid plan, stated as such, with no dead controls beside it.",
      step: "free",
      viewport: "phone",
      render: () => <Card handlers={SUBSCRIPTION_FREE_HANDLERS} />,
    },
    "past-due": {
      description:
        "The last payment bounced — what that costs, and what fixes it, above the buttons.",
      step: "past_due",
      render: () => <Card handlers={SUBSCRIPTION_PAST_DUE_HANDLERS} />,
    },
    cancelled: {
      description:
        "Already cancelled: 'Runs until' replaces 'Renews on', and cancelling again is off with its reason.",
      step: "cancelled",
      render: () => <Card handlers={SUBSCRIPTION_CANCELLED_HANDLERS} />,
    },
  },
});
