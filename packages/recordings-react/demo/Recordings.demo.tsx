/** Recordings provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RecordingsProvider } from "../src/index.js";
import { RecordingsDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function RecordingsProviderDemo(): ReactElement {
  return (
    <RecordingsDemoHarness>
      <DemoCard heading="RecordingsProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </RecordingsDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `RecordingsProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "recordings.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "recordings.provider",
  title: "Recordings provider",
  description:
    "The headless recordings root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: RecordingsProvider,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <RecordingsProviderDemo /> },
  },
});
