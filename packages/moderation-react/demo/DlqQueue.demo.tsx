/**
 * The dead-letter park — the tab that exists so an outage stops looking like
 * a busy queue.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DlqQueue } from "../src/default/admin/index.js";
import { ModerationDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CASE_DLQ_CONTENT,
  CASE_DLQ_CONTENT_2,
  CASE_DLQ_SCREENER,
  POLICY,
  STAFF_ONLY,
  STATS,
  STATS_CLEAR_DLQ,
} from "./_fixtures.js";

/** Order matters: the harness matches the FIRST suffix the URL contains, and
 * `/cases/<id>` contains `/cases`. */
const TWO_FAULTS: DemoHandlers = {
  "/stats": STATS,
  "/policy": POLICY,
  "/cases": [CASE_DLQ_CONTENT, CASE_DLQ_CONTENT_2, CASE_DLQ_SCREENER],
};

const ONE_FAULT: DemoHandlers = {
  "/stats": STATS,
  "/policy": POLICY,
  "/cases": [CASE_DLQ_SCREENER],
};

const NOTHING_BROKEN: DemoHandlers = {
  "/stats": STATS_CLEAR_DLQ,
  "/policy": POLICY,
  "/cases": [],
};

const NOT_STAFF: DemoHandlers = {
  "/stats": STAFF_ONLY,
  "/policy": POLICY,
  "/cases": STAFF_ONLY,
};

function Park(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <ModerationDemoHarness handlers={props.handlers}>
      <DlqQueue />
    </ModerationDemoHarness>
  );
}

export default defineDemo({
  id: "moderation.dlq",
  title: "Dead-letter park (engineering)",
  description:
    "Cases the screening seam gave up on, which are NOT the moderator's queue: they carry no verdict, nothing looked at them, and they are repaired rather than decided. Grouped by `last_error_class` with the class as a chip and the server's own message one click away, because the stand this state was built for was running two unrelated faults at once and a single 'screening unavailable' counter sent people to fix the wrong one. Every row can be sent back through the screener, and so can all of them at once — a per-row call with a progress count, because there is no bulk route on the wire and a button that said 'done' after firing twenty requests it never watched would be the same lie in a smaller place.",
  component: DlqQueue,
  tokens: ["surface-base", "surface-raised", "error"],
  variants: {
    default: {
      description:
        "Two faults at once — a content function asked for a key that names nothing, and an unreachable screener — as two groups, biggest first.",
      viewport: "desktop",
      step: "grouped",
      render: () => <Park handlers={TWO_FAULTS} />,
    },
    phone: {
      description:
        "One fault, on a phone. The rows are cards at every width: a dead letter has few facts and one of them is a stack-trace tail, which no table column can hold.",
      viewport: "phone",
      step: "populated",
      render: () => <Park handlers={ONE_FAULT} />,
    },
    empty: {
      description:
        "Nothing has failed screening — the only empty state in this console that is good news about the machines rather than about people.",
      viewport: "phone",
      step: "empty",
      render: () => <Park handlers={NOTHING_BROKEN} />,
    },
    "not-staff": {
      description:
        "A signed-in person without the mandate. Named as a door, not rendered as an operations failure — the nav axis cannot say 'staff'.",
      viewport: "phone",
      step: "forbidden",
      render: () => <Park handlers={NOT_STAFF} />,
    },
  },
});
