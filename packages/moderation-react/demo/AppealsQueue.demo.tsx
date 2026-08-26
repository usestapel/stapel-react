/**
 * The appeal desk — and the row that is not yours to decide.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AppealsQueue } from "../src/default/admin/index.js";
import { ModerationDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { APPEAL_OPEN, APPEAL_UPHELD } from "./_fixtures.js";

const WAITING: DemoHandlers = { "/appeals/queue": [APPEAL_OPEN] };
const DECIDED: DemoHandlers = { "/appeals/queue": [APPEAL_UPHELD] };
const NONE: DemoHandlers = { "/appeals/queue": [] };

function Desk(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <ModerationDemoHarness handlers={props.handlers}>
      <AppealsQueue />
    </ModerationDemoHarness>
  );
}

export default defineDemo({
  id: "moderation.appeals-queue",
  title: "Appeals (staff)",
  description:
    "Overturning is the module's single backward edge — `resolved → queued`, the case is reopened and decided again — so the outcome choices carry a line of meaning each rather than three bare words. Two refusals share this screen and mean opposite things: `same_actor` says you decided the case so a colleague must hear the appeal (nothing is broken), while `appeal_resolved` says there is nothing left to decide. Both are read from the write's own answer rather than guessed from the row, because a colleague can decide an appeal between this page being drawn and the sheet being submitted.",
  component: AppealsQueue,
  tokens: ["surface-base", "surface-raised", "success"],
  variants: {
    default: {
      description: "One appeal waiting, with the way into the resolve sheet.",
      viewport: "desktop",
      step: "open",
      render: () => <Desk handlers={WAITING} />,
    },
    decided: {
      description:
        "An appeal that has already been heard: the control is shut and names the reason, rather than being hidden or lit and then refused.",
      viewport: "phone",
      step: "decided",
      render: () => <Desk handlers={DECIDED} />,
    },
    empty: {
      description: "Nobody has appealed anything — said, not left blank.",
      viewport: "phone",
      step: "empty",
      render: () => <Desk handlers={NONE} />,
    },
  },
});
