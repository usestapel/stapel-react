/** Workspaces provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { WorkspacesProvider } from "../src/index.js";
import { WorkspacesDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function WorkspacesProviderDemo(): ReactElement {
  return (
    <WorkspacesDemoHarness>
      <DemoCard heading="WorkspacesProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </WorkspacesDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `WorkspacesProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "workspaces.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "workspaces.provider",
  title: "Workspaces provider",
  description:
    "The headless workspaces root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: WorkspacesProvider,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <WorkspacesProviderDemo /> },
  },
});
