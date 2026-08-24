/**
 * The DEFAULT SKIN in the viewer — because the default skin is what a host
 * actually ships. The headless demo beside this one documents the layer a host
 * REPLACES; this one documents the layer it MOUNTS.
 *
 * The `phone` variant is not decoration: the viewer offers 390/768/1280
 * (`showcase-viewer/.ladle/config.mjs`), and a skin component that has never
 * been drawn at 390 is a skin nobody has checked on the device most people use.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { WebhooksPanel } from "../src/default/index.js";
import { WebhooksDemoHarness } from "./_harness.js";

function WebhooksPanelDemo(props: { loading?: boolean }): ReactElement {
  return (
    <WebhooksDemoHarness>
      <WebhooksPanel {...(props.loading === true ? { loading: true } : {})} />
    </WebhooksDemoHarness>
  );
}

export default defineDemo({
  id: "webhooks.panel-skin",
  title: "Webhooks panel (default skin)",
  description:
    "The shipped webhooks surface: one themed card with the empty and loading states a screen owes a person. Replace the body as the pair grows read hooks; keep the frame.",
  component: WebhooksPanel,
  variants: {
    default: {
      description: "Desktop width, nothing to show yet.",
      viewport: "desktop",
      step: "empty",
      render: () => <WebhooksPanelDemo />,
    },
    phone: {
      description: "The same surface at 390px — the design width.",
      viewport: "phone",
      step: "empty",
      render: () => <WebhooksPanelDemo />,
    },
    loading: {
      description: "Data in flight: the panel says so instead of drawing an empty box.",
      viewport: "phone",
      step: "loading",
      render: () => <WebhooksPanelDemo loading />,
    },
  },
});
