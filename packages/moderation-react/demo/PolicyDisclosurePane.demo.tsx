/**
 * The public rules page — every claim on it computed from the deployment.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PolicyDisclosurePane } from "../src/default/index.js";
import { ModerationDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { POLICY, POLICY_NO_AUTOMATION } from "./_fixtures.js";

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <ModerationDemoHarness handlers={props.handlers}>
      <PolicyDisclosurePane />
    </ModerationDemoHarness>
  );
}

export default defineDemo({
  id: "moderation.policy",
  title: "Content rules (public)",
  description:
    "DSA Art. 15, rendered rather than written: `GET policy` builds its answer from the live configuration — the registered reasons, the screening stages actually wired, the confidence floor actually applied, whether an appeal really goes to a different moderator. Turning the screener off changes this page on the next load with no copy change anywhere, which is the only version of a transparency page that cannot go stale. It is the module's one anonymous route, because a rules page that demanded a session would be the page nobody could check the rules on.",
  component: PolicyDisclosurePane,
  tokens: ["surface-base", "surface-raised"],
  variants: {
    default: {
      description: "Screening on: the stages, the floor, and what happens when it cannot run.",
      viewport: "phone",
      step: "automated",
      render: () => <Pane handlers={{ "/policy": POLICY }} />,
    },
    "human-only": {
      description:
        "The same page for a deployment that screens nothing — one sentence, and no floor to disclose.",
      viewport: "desktop",
      step: "human_only",
      render: () => <Pane handlers={{ "/policy": POLICY_NO_AUTOMATION }} />,
    },
    failed: {
      description:
        "The disclosure could not be read: a retry, not a page that quietly claims there are no rules.",
      viewport: "phone",
      step: "failed",
      render: () => <Pane handlers={{ "/policy": [503, {}] }} />,
    },
  },
});
