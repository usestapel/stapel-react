/**
 * The appeal page, including the arm that exists because an endpoint does not.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AppealPanel } from "../src/default/index.js";
import { ModerationDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { APPEAL_OPEN, APPEAL_UPHELD, CASE_QUEUED } from "./_fixtures.js";

const NONE: DemoHandlers = { "/appeals/": [] };
const SENT: DemoHandlers = { "/appeals/": [APPEAL_UPHELD, APPEAL_OPEN] };

function Panel(props: {
  handlers: DemoHandlers;
  caseId?: string;
}): ReactElement {
  return (
    <ModerationDemoHarness handlers={props.handlers}>
      <AppealPanel {...(props.caseId !== undefined ? { caseId: props.caseId } : {})} />
    </ModerationDemoHarness>
  );
}

export default defineDemo({
  id: "moderation.appeal-panel",
  title: "Appeal a decision",
  description:
    "DSA Art. 20, and the one arm that is an EXPLANATION rather than a shrug: without a `?case=` in the link there is nothing to appeal against, and this pair cannot look one up — `GET cases` and `GET cases/{id}` are both behind the moderation mandate, so the id travels exactly one way, in the notification's deep link. Drawing the composer anyway would give somebody a submit button that could never light up. The appeals already sent are the person's own read and are listed regardless, with the outcome the moderator wrote back.",
  component: AppealPanel,
  tokens: ["surface-base", "surface-raised", "success"],
  variants: {
    default: {
      description:
        "Opened without the link: what an appeal needs, and where the reference lives.",
      viewport: "phone",
      step: "no_case",
      render: () => <Panel handlers={NONE} />,
    },
    writing: {
      description: "Opened from the notification — the composer, gated until it says something.",
      viewport: "phone",
      step: "writing",
      render: () => <Panel handlers={NONE} caseId={CASE_QUEUED.id} />,
    },
    "with-history": {
      description:
        "Two appeals already sent: one decided with the moderator's answer, one still waiting.",
      viewport: "desktop",
      step: "list",
      render: () => <Panel handlers={SENT} caseId={CASE_QUEUED.id} />,
    },
  },
});
