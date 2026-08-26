/**
 * THE DEFAULT SKIN, IN THE VIEWER — because the default skin is the product.
 *
 * Until wave B every billing story documented a headless bag: a debug card
 * with the component's class name as a heading, a `state.step` chip and two
 * naked buttons. Sixteen designed screens across the account group had never
 * been photographed, and this pair's wallet was one of them — so the showcase
 * showed the render-prop test bench and called it a wallet.
 *
 * These four variants are the four things a person can find here: the healthy
 * account, the same account owing credits, an account with nothing in it, and
 * the shop refusing rather than claiming it sells nothing.
 *
 * Drag the viewer's width control across 768px on `default`: the shop's two
 * columns come from THIS element's width, not the window's, so the same
 * component in a narrow host panel gets the narrow layout.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { WalletPanel } from "../src/default/WalletPanel.js";
import { BillingDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  WALLET_PANEL_DEBT_HANDLERS,
  WALLET_PANEL_EMPTY_HANDLERS,
  WALLET_PANEL_HANDLERS,
  WALLET_PANEL_SHOP_DOWN_HANDLERS,
} from "./fixtures.js";

/** Checkout and the customer portal both redirect the whole page; inside a
 * viewer that would navigate the frame away from the story, so the demo
 * swallows the URL instead of following it. */
function stay(): void {
  return undefined;
}

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <BillingDemoHarness handlers={props.handlers}>
      <WalletPanel onCheckoutUrl={stay} />
    </BillingDemoHarness>
  );
}

export default defineDemo({
  id: "billing.wallet-panel",
  title: "Billing page (default skin)",
  description:
    "The shipped billing screen: the two credit pools stated separately (bought credits that never expire vs plan credits with a deadline — never one sum), any debt with what the next purchase settles, the subscription and its next date, both ways to buy with the price per credit under each, automatic top-up, and the credit ledger.",
  component: WalletPanel,
  // The billing page mounts the provider and drives the headless pricing
  // bag, so this one story is the honest coverage for both — the harness
  // stories that used to claim it printed a `state.step` chip and nothing
  // a customer could read.
  covers: ["BillingProvider", "PricingTable"],
  variants: {
    default: {
      description:
        "840 bought credits and 400 that die on the 1st, a live Team plan, and the shop below.",
      step: "ready",
      render: () => <Panel handlers={WALLET_PANEL_HANDLERS} />,
    },
    "in-debt": {
      description:
        "The wallet owes 180 credits. Each offer says how many of its credits go straight to the debt.",
      step: "debt",
      viewport: "phone",
      render: () => <Panel handlers={WALLET_PANEL_DEBT_HANDLERS} />,
    },
    empty: {
      description:
        "A brand-new account: nothing held, no paid plan, no history — and a door out of every one of those.",
      step: "empty",
      viewport: "phone",
      render: () => <Panel handlers={WALLET_PANEL_EMPTY_HANDLERS} />,
    },
    "shop-down": {
      description:
        "The catalogue read fails. The shop states the refusal; it never renders as 'nothing is on sale'.",
      step: "failed",
      render: () => <Panel handlers={WALLET_PANEL_SHOP_DOWN_HANDLERS} />,
    },
  },
});
