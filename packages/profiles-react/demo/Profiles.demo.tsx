/** Profiles provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ProfilesProvider } from "../src/index.js";
import { ProfilesDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function ProfilesProviderDemo(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <DemoCard heading="ProfilesProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </ProfilesDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `ProfilesProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "profiles.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "profiles.provider",
  title: "Profiles provider",
  description:
    "The headless profiles root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: ProfilesProvider,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <ProfilesProviderDemo /> },
  },
});
