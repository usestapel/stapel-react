/** Notifications provider — the pair's headless root (starter demo). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { NotificationsProvider } from "../src/index.js";
import { NotificationsDemoHarness, DemoCard, StepBadge } from "./_harness.js";

function NotificationsProviderDemo(): ReactElement {
  return (
    <NotificationsDemoHarness>
      <DemoCard heading="NotificationsProvider">
        <StepBadge step="ready" />
      </DemoCard>
    </NotificationsDemoHarness>
  );
}

/**
 * The completeness gate (gen:demos) requires every exported headless component
 * to have ≥1 demo. This starter demo covers `NotificationsProvider` — the pair's only
 * headless export at scaffold time. Add one `<Name>.demo.tsx` per headless flow
 * component (with `defineDemo({ component: <X>, flow: "notifications.<id>", … })`)
 * as you build them; each becomes a smoke test AND a Ladle story automatically.
 */
export default defineDemo({
  id: "notifications.provider",
  title: "Notifications provider",
  description:
    "The headless notifications root wires the runtime, i18n engine, and query client into React context. Replace with per-flow demos as you add headless components.",
  component: NotificationsProvider,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <NotificationsProviderDemo /> },
  },
});
