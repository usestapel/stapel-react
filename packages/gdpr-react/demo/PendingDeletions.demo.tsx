/**
 * Everything of this person's that is on its way out — two clocks, and the
 * per-row detail that answers "why is this still here?".
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PendingDeletions } from "../src/default/PendingDeletions.js";
import { GdprDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { ERASURE_ERASING, ERASURE_TIMEOUT } from "./_fixtures.js";

/** "Nothing of yours is waiting to be deleted" is an ANSWER, and it is only
 * sayable from a load that succeeded. */
const NOTHING: DemoHandlers = {
  "/me/erasures": [],
};

/** One recording on its way out, still waiting on an owner. */
const ERASING: DemoHandlers = {
  "/erasures/17": ERASURE_ERASING,
  "/me/erasures": [ERASURE_ERASING],
};

/** An owner never receipted: the module marks the request `timeout` rather
 * than leaving it `queued` forever, and the table raises it. */
const OVERDUE: DemoHandlers = {
  "/erasures/18": ERASURE_TIMEOUT,
  "/me/erasures": [ERASURE_TIMEOUT, ERASURE_ERASING],
};

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <GdprDemoHarness handlers={props.handlers}>
      <PendingDeletions
        labelFor={(_type, key) => (key === "9f1c2d3e" ? "Stand-up, 12 August" : key)}
      />
    </GdprDemoHarness>
  );
}

export default defineDemo({
  id: "gdpr.pending-deletions",
  title: "Waiting to be deleted",
  description:
    "Two date columns because there are two clocks: `due_at` is when OUR systems are done, `fully_erased_by` stretches that to the last subprocessor's contractual window — so a recording can be gone from us on 23 September and gone from everywhere on 18 October. The difference is explained as TEXT under the table, not as a tooltip on a column header, because a phone has no hover. Opening a row reads that one erasure and shows the per-owner receipts and the processor windows behind the second date.",
  component: PendingDeletions,
  tokens: ["surface-raised", "warning", "error", "success"],
  variants: {
    default: {
      description: "The empty arm — an answer, reachable only from a load that worked.",
      viewport: "phone",
      step: "empty",
      render: () => <Panel handlers={NOTHING} />,
    },
    erasing: {
      description:
        "One recording being erased, both clocks, and the owner it is still waiting on.",
      viewport: "phone",
      step: "erasing",
      render: () => <Panel handlers={ERASING} />,
    },
    overdue: {
      description:
        "A request no owner ever confirmed: raised as a banner, not left as a quiet green tick.",
      viewport: "desktop",
      step: "timeout",
      render: () => <Panel handlers={OVERDUE} />,
    },
  },
});
