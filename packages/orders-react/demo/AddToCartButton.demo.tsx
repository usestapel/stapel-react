/** The headless add-to-cart control: a native button, no visual opinion. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AddToCartButton } from "../src/index.js";
import { OrdersDemoHarness } from "./_harness.js";
import { DEMO_CART } from "./_fixtures.js";

function Demo(): ReactElement {
  return (
    <OrdersDemoHarness handlers={{ "cart/": DEMO_CART }}>
      <AddToCartButton purchasableType="listing" purchasableKey="101" />
    </OrdersDemoHarness>
  );
}

export default defineDemo({
  id: "orders.add-to-cart",
  title: "Add to cart (headless)",
  description:
    "A native button that always carries data-testid=add-to-cart and owns its POST cart/lines/ request; a page only names the purchasable.",
  component: AddToCartButton,
  tokens: ["surface-raised"],
  variants: {
    default: { viewport: "phone", step: "ready", render: () => <Demo /> },
  },
});
