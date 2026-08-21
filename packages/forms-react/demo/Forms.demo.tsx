/** Forms provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FormsProvider } from "../src/index.js";
import { FormsDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function FormsProviderDemo(): ReactElement {
  return (
    <FormsDemoHarness>
      <DemoCard heading="FormsProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </FormsDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This one covers `FormsProvider`, which has nothing to show
 * but the fact that it wires the runtime — the four components that DO have
 * behaviour get their own demos (`FormFill`, `FormBuilder`, `ResponsesTable`,
 * `FormList`), each a smoke test and a Ladle story.
 */
export default defineDemo({
  id: "forms.provider",
  title: "Forms provider",
  description:
    "The headless forms root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: FormsProvider,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <FormsProviderDemo /> },
  },
});
