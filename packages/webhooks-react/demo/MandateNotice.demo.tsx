/**
 * The 503 that is not about the person.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MandateNotice } from "../src/default/MandateNotice.js";
import { WebhooksDemoHarness } from "./_harness.js";

function Notice(props: { retry?: boolean }): ReactElement {
  return (
    <WebhooksDemoHarness>
      <MandateNotice
        {...(props.retry === true ? { onRetry: () => undefined } : {})}
      />
    </WebhooksDemoHarness>
  );
}

export default defineDemo({
  id: "webhooks.mandate-notice",
  title: "Workspace mandate unavailable",
  description:
    "Every route of stapel-webhooks is guarded by the workspace-mandate check, and in a tenant deployment that guard can answer 503 `mandate_unavailable`: we could not verify whether you belong to this workspace. It is not a permission failure and not a fault in anybody's webhook configuration — which is exactly the conclusion a red error banner invites on a developer-settings tab. So it has an arm of its own, in the voice that fits: this is on our side, it is temporary, here is the retry. Every read in the pair routes its failed arm through this component.",
  component: MandateNotice,
  tokens: ["info", "text-muted"],
  variants: {
    default: {
      description: "With the retry, which is the only action that makes sense.",
      viewport: "desktop",
      step: "with_retry",
      render: () => <Notice retry />,
    },
    phone: {
      description:
        "390px — the notice a person meets on a phone when the mandate source blinked.",
      viewport: "phone",
      step: "phone",
      render: () => <Notice retry />,
    },
    "no-retry": {
      description:
        "Embedded where the host owns the refresh: the sentence stays, the control does not appear twice.",
      viewport: "desktop",
      step: "no_retry",
      render: () => <Notice />,
    },
  },
});
