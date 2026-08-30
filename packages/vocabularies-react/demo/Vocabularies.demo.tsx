/** Vocabularies provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { VocabulariesProvider } from "../src/index.js";
import { VocabulariesDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function VocabulariesProviderDemo(): ReactElement {
  return (
    <VocabulariesDemoHarness>
      <DemoCard heading="VocabulariesProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </VocabulariesDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `VocabulariesProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "vocabularies.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "vocabularies.provider",
  title: "Vocabularies provider",
  description:
    "The headless vocabularies root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: VocabulariesProvider,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <VocabulariesProviderDemo /> },
  },
});
