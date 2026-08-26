/**
 * The page a route mounts — the whole developer-settings tab.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { WebhooksSettingsPane } from "../src/default/WebhooksSettingsPane.js";
import { WebhooksDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { AUTO_DISABLED, CATALOG, HEALTHY, NOTIFICATION_RULE } from "./_fixtures.js";

const FULL: DemoHandlers = {
  "/event-catalog": CATALOG,
  "/subscriptions": [HEALTHY, NOTIFICATION_RULE, AUTO_DISABLED],
};

const EMPTY: DemoHandlers = {
  "/event-catalog": CATALOG,
  "/subscriptions": [],
};

function Page(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <WebhooksDemoHarness handlers={props.handlers}>
      <WebhooksSettingsPane />
    </WebhooksDemoHarness>
  );
}

export default defineDemo({
  id: "webhooks.settings-page",
  title: "Webhooks (developer settings)",
  description:
    "The tab under account settings, beside two-factor and sessions — because a webhook is something you configure about your own account, not a third of the product's navigation. The page adds exactly two things to the list: one sentence saying what a webhook is, and the host's link to its receiver documentation. Both matter on the first visit, which for this feature is the visit that decides whether anybody uses it: the signature scheme, the header names and the 300-second tolerance live in the backend's `signing.py` and are served nowhere, so without that link a person leaves here holding a secret they have no way to verify with.",
  component: WebhooksSettingsPane,
  tokens: ["surface-raised", "surface-base", "text-muted"],
  variants: {
    default: {
      description:
        "Three rules: one healthy signed webhook, one notification, one the backend switched off after repeated failures.",
      viewport: "desktop",
      step: "ready",
      render: () => <Page handlers={FULL} />,
    },
    phone: {
      description:
        "The same page at 390px — the table becomes cards, and the switch keeps its 44px target.",
      viewport: "phone",
      step: "ready_phone",
      render: () => <Page handlers={FULL} />,
    },
    empty: {
      description:
        "Nobody has made one yet: the empty state explains what a webhook IS before offering the button, because the person who reaches this screen with nothing on it is the person who does not know yet.",
      viewport: "phone",
      step: "empty",
      render: () => <Page handlers={EMPTY} />,
    },
  },
});
