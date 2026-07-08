/** Calendar provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CalendarProvider } from "../src/index.js";
import { CalendarDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function CalendarProviderDemo(): ReactElement {
  return (
    <CalendarDemoHarness>
      <DemoCard heading="CalendarProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </CalendarDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `CalendarProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "calendar.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "calendar.provider",
  title: "Calendar provider",
  description:
    "The headless calendar root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: CalendarProvider,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <CalendarProviderDemo /> },
  },
});
