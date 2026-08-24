/**
 * The shop alone — for a host that owns its own pricing page.
 *
 * The catalogue comes through the headless `PricingTable` bag exactly as the
 * wallet screen supplies it, so what is photographed here is the composition
 * a host would write, not a hand-built `LoadState`.
 *
 * `subscribed` is the variant worth looking at: the caller already holds
 * `team`, so that card is marked as their plan and its button is switched off
 * WITH the reason printed beside it, rather than offering the state they are
 * already in.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { BuyOptions } from "../src/default/BuyOptions.js";
import { PricingTable } from "../src/index.js";
import { BillingDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { SHOP_HANDLERS, SHOP_SUBSCRIBED_HANDLERS } from "./fixtures.js";

function Shop(props: {
  handlers: DemoHandlers;
  debtOutstanding?: number;
}): ReactElement {
  return (
    <BillingDemoHarness handlers={props.handlers}>
      <PricingTable>
        {(bag) => (
          <BuyOptions
            state={bag.state}
            isCheckingOut={bag.isCheckingOut}
            debtOutstanding={props.debtOutstanding ?? 0}
            onChoose={bag.checkout}
            onRetry={bag.refetch}
          />
        )}
      </PricingTable>
    </BillingDemoHarness>
  );
}

export default defineDemo({
  id: "billing.buy-options",
  title: "Two ways to buy (default skin)",
  description:
    "Packages and plans side by side with the same per-credit number under both, so the comparison needs no calculator. The columns are sized by the element, not the viewport. The plan the caller already holds is marked and cannot be bought again.",
  component: BuyOptions,
  variants: {
    default: {
      description:
        "No subscription: both columns open, the cheaper side carrying the ribbon and the saving stated per credit.",
      step: "ready",
      viewport: "phone",
      render: () => <Shop handlers={SHOP_HANDLERS} />,
    },
    subscribed: {
      description:
        "The caller is on Team. That card says so and its button is off, with the reason beside it.",
      step: "current-plan",
      render: () => <Shop handlers={SHOP_SUBSCRIBED_HANDLERS} />,
    },
    "settling-a-debt": {
      description:
        "The wallet owes 180 credits, so every offer states how many of its credits are already spoken for.",
      step: "debt",
      viewport: "phone",
      render: () => <Shop handlers={SHOP_HANDLERS} debtOutstanding={180} />,
    },
  },
});
