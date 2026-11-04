/** Order detail — the default skin. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { OrderDetailPane } from "../src/default/index.js";
import { OrdersDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_ORDER } from "./_fixtures.js";

const READY: DemoHandlers = { "orders/501/": DEMO_ORDER };

function Demo(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <OrdersDemoHarness handlers={props.handlers}>
      <OrderDetailPane id="501" />
    </OrdersDemoHarness>
  );
}

export default defineDemo({
  id: "orders.detail-pane",
  title: "Order detail",
  description:
    "One order: lines, total, delivery address and the cancel button while the order is cancellable.",
  component: OrderDetailPane,
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
