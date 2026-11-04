/** Cart badge — the default skin. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CartBadge } from "../src/default/index.js";
import { OrdersDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_CART } from "./_fixtures.js";

const READY: DemoHandlers = { "cart/": DEMO_CART };

function Demo(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <OrdersDemoHarness handlers={props.handlers}>
      <CartBadge href="#cart" />
    </OrdersDemoHarness>
  );
}

export default defineDemo({
  id: "orders.cart-badge",
  title: "Cart badge",
  description:
    "The top-bar badge: the line count of the cart, hidden while the cart is empty.",
  component: CartBadge,
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
