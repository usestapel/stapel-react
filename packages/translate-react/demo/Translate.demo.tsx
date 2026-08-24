/** Translate provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TranslateProvider } from "../src/index.js";
import { TranslateDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function TranslateProviderDemo(): ReactElement {
  return (
    <TranslateDemoHarness>
      <DemoCard heading="TranslateProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </TranslateDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `TranslateProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "translate.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "translate.provider",
  title: "Translate provider",
  description:
    "The headless translate root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: TranslateProvider,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <TranslateProviderDemo /> },
  },
});
