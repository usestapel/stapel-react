/** Webhooks provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { WebhooksProvider } from "../src/index.js";
import { WebhooksDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function WebhooksProviderDemo(): ReactElement {
  return (
    <WebhooksDemoHarness>
      <DemoCard heading="WebhooksProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </WebhooksDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `WebhooksProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "webhooks.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "webhooks.provider",
  title: "Webhooks provider",
  description:
    "The headless webhooks root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: WebhooksProvider,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <WebhooksProviderDemo /> },
  },
});
