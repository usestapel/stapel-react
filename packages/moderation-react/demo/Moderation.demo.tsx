/** Moderation provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ModerationProvider } from "../src/index.js";
import { ModerationDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function ModerationProviderDemo(): ReactElement {
  return (
    <ModerationDemoHarness>
      <DemoCard heading="ModerationProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </ModerationDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `ModerationProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "moderation.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "moderation.provider",
  title: "Moderation provider",
  description:
    "The headless moderation root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: ModerationProvider,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <ModerationProviderDemo /> },
  },
});
