/** Checkout page — the default skin. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CheckoutPage } from "../src/default/index.js";
import { OrdersDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_CART, DEMO_ORDER } from "./_fixtures.js";

const READY: DemoHandlers = { "cart/": DEMO_CART, "checkout/": [201, DEMO_ORDER] };

function Demo(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <OrdersDemoHarness handlers={props.handlers}>
      <CheckoutPage onNavigate={() => undefined} />
    </OrdersDemoHarness>
  );
}

export default defineDemo({
  id: "orders.checkout-page",
  title: "Checkout page",
  description:
    "Contact and delivery address, one submit that sends the same idempotency key until it succeeds.",
  component: CheckoutPage,
  variants: {
    default: {
      description: "Desktop width.",
      viewport: "desktop",
      step: "form",
      render: () => <Demo handlers={READY} />,
    },
    phone: {
      description: "The same surface at 390px, the design width.",
      viewport: "phone",
      step: "form",
      render: () => <Demo handlers={READY} />,
    },
  },
});
