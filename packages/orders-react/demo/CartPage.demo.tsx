/** Cart page — the default skin. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CartPage } from "../src/default/index.js";
import { OrdersDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_CART, DEMO_EMPTY_CART } from "./_fixtures.js";

const READY: DemoHandlers = { "cart/": DEMO_CART };

function Demo(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <OrdersDemoHarness handlers={props.handlers}>
      <CartPage />
    </OrdersDemoHarness>
  );
}

export default defineDemo({
  id: "orders.cart-page",
  title: "Cart page",
  description:
    "The cart: one row per line with a quantity stepper, the server-summed total and the link to checkout.",
  component: CartPage,
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
    empty: {
      description: "An empty cart says so.",
      viewport: "phone",
      step: "empty",
      render: () => <Demo handlers={{ "cart/": DEMO_EMPTY_CART }} />,
    },
  },
});
