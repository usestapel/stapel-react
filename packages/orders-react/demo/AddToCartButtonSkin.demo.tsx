/** Add to cart (default skin) — the default skin. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AddToCartButton } from "../src/default/index.js";
import { OrdersDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_CART } from "./_fixtures.js";

const READY: DemoHandlers = { "cart/": DEMO_CART };

function Demo(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <OrdersDemoHarness handlers={props.handlers}>
      <AddToCartButton purchasableType="listing" purchasableKey="101" />
    </OrdersDemoHarness>
  );
}

export default defineDemo({
  id: "orders.add-to-cart-skin",
  title: "Add to cart (default skin)",
  description:
    "The antd add-to-cart control: it owns its request and offers Go to cart after a success.",
  component: AddToCartButton,
  variants: {
    default: {
      description: "Desktop width.",
      viewport: "desktop",
      step: "ready",
      render: () => <Demo handlers={READY} />,
    },
    phone: {
      description: "The same surface at 390px, the design width.",
      viewport: "phone",
      step: "ready",
      render: () => <Demo handlers={READY} />,
    },
  },
});
