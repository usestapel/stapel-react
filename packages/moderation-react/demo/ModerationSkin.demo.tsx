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
import { ModerationPanel } from "../src/default/index.js";
import { ModerationDemoHarness } from "./_harness.js";

function ModerationPanelDemo(props: { loading?: boolean }): ReactElement {
  return (
    <ModerationDemoHarness>
      <ModerationPanel {...(props.loading === true ? { loading: true } : {})} />
    </ModerationDemoHarness>
  );
}

export default defineDemo({
  id: "moderation.panel-skin",
  title: "Moderation panel (default skin)",
  description:
    "The shipped moderation surface: one themed card with the empty and loading states a screen owes a person. Replace the body as the pair grows read hooks; keep the frame.",
  component: ModerationPanel,
  variants: {
    default: {
      description: "Desktop width, nothing to show yet.",
      viewport: "desktop",
      step: "empty",
      render: () => <ModerationPanelDemo />,
    },
    phone: {
      description: "The same surface at 390px — the design width.",
      viewport: "phone",
      step: "empty",
      render: () => <ModerationPanelDemo />,
    },
    loading: {
      description: "Data in flight: the panel says so instead of drawing an empty box.",
      viewport: "phone",
      step: "loading",
      render: () => <ModerationPanelDemo loading />,
    },
  },
});
