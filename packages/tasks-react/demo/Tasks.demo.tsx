/** Tasks provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TasksProvider } from "../src/index.js";
import { TasksDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function TasksProviderDemo(): ReactElement {
  return (
    <TasksDemoHarness>
      <DemoCard heading="TasksProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </TasksDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `TasksProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "tasks.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "tasks.provider",
  title: "Tasks provider",
  description:
    "The headless tasks root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: TasksProvider,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <TasksProviderDemo /> },
  },
});
