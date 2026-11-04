/** Order history — the default skin. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { OrderHistoryPane } from "../src/default/index.js";
import { OrdersDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_ORDER_PAGE } from "./_fixtures.js";

const READY: DemoHandlers = { "orders/": DEMO_ORDER_PAGE };

function Demo(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <OrdersDemoHarness handlers={props.handlers}>
      <OrderHistoryPane />
    </OrdersDemoHarness>
  );
}

export default defineDemo({
  id: "orders.history-pane",
  title: "Order history",
  description:
    "The orders of the signed-in person, newest first: number, status, total and date per row.",
  component: OrderHistoryPane,
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
      description: "No orders yet.",
      viewport: "phone",
      step: "empty",
      render: () => <Demo handlers={{ "orders/": { ...DEMO_ORDER_PAGE, items: [], count: 0 } }} />,
    },
  },
});
