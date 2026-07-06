/** Billing provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { BillingProvider } from "../src/index.js";
import { BillingDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function BillingProviderDemo(): ReactElement {
  return (
    <BillingDemoHarness>
      <DemoCard heading="BillingProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </BillingDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `BillingProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "billing.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "billing.provider",
  title: "Billing provider",
  description:
    "The headless billing root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: BillingProvider,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <BillingProviderDemo /> },
  },
});
