/** Orders provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { OrdersProvider } from "../src/index.js";
import { OrdersDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function OrdersProviderDemo(): ReactElement {
  return (
    <OrdersDemoHarness>
      <DemoCard heading="OrdersProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </OrdersDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `OrdersProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "orders.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "orders.provider",
  title: "Orders provider",
  description:
    "The headless orders root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: OrdersProvider,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <OrdersProviderDemo /> },
  },
});
