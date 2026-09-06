/**
 * The console's front door, and the 403 that is a person rather than a fault.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ModerationQueue } from "../src/default/admin/index.js";
import { ModerationDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CASE_CLAIMED,
  CASE_DLQ_CONTENT,
  CASE_DLQ_SCREENER,
  CASE_QUEUED,
  POLICY,
  STAFF_ONLY,
  STATS,
} from "./_fixtures.js";

/** Order matters: the harness matches the FIRST suffix the URL contains, and
 * `/cases/<id>` contains `/cases`. */
const BUSY: DemoHandlers = {
  "/stats": STATS,
  "/policy": POLICY,
  "/cases": [CASE_QUEUED, CASE_CLAIMED],
};

const HELD: DemoHandlers = {
  "/stats": STATS,
  "/policy": POLICY,
  "/cases": [CASE_CLAIMED],
};

const CLEAR: DemoHandlers = {
  "/stats": { ...STATS, open_total: 0 },
  "/policy": POLICY,
  "/cases": [],
};

const NOT_STAFF: DemoHandlers = {
  "/stats": STAFF_ONLY,
  "/policy": POLICY,
  "/cases": STAFF_ONLY,
};

/** The park behind the second tab. `state=dlq` is matched BEFORE the bare
 * `/cases`, so the two tabs of one screen answer with different rows — which
 * is the whole claim this variant is here to show. */
const PARKED: DemoHandlers = {
  "/stats": STATS,
  "/policy": POLICY,
  "state=dlq": [CASE_DLQ_CONTENT, CASE_DLQ_SCREENER],
  "/cases": [CASE_QUEUED, CASE_CLAIMED],
};

function Queue(props: {
  handlers: DemoHandlers;
  initialTab?: "queue" | "dlq";
}): ReactElement {
  return (
    <ModerationDemoHarness handlers={props.handlers}>
      <ModerationQueue
        {...(props.initialTab !== undefined ? { initialTab: props.initialTab } : {})}
      />
    </ModerationDemoHarness>
  );
}

export default defineDemo({
  id: "moderation.queue",
  title: "Moderation queue (staff)",
  description:
    "Two tabs: the moderator's queue (asked for as `state=queued` — an unfiltered read now returns dead letters beside it) and the DLQ, which belongs to whoever repairs the screening seam. Table where there is room, cards where there is not — decided by the ELEMENT's width, not the viewport's, because a console lives in an admin shell's content column as often as on a full page and antd's grid breakpoints would give a 380px panel on a 1920px desktop the eight-column table. The target column shows `type:key` and nothing else unless the host fills `renderTarget`: the module is domain-blind and the backend serves content on the case card only, so a thumbnail here can only come from whoever owns the target. The mandate refusal is named, not rendered as a failed read — the nav axis has no 'staff' value, so the screen does the explaining.",
  component: ModerationQueue,
  tokens: ["surface-base", "surface-raised", "warning", "success"],
  variants: {
    default: {
      description: "Two cases, one of them held by a colleague, with the counters above.",
      viewport: "desktop",
      step: "populated",
      render: () => <Queue handlers={BUSY} />,
    },
    phone: {
      description:
        "The same queue as cards, and the five filter fields collapsed behind one control that says how many of them are on — a filter bar is the most width-hungry part of a console and the least of what a moderator came for.",
      viewport: "phone",
      step: "cards",
      render: () => <Queue handlers={HELD} />,
    },
    empty: {
      description: "Nothing matches — the good empty, said rather than left blank.",
      viewport: "phone",
      step: "empty",
      render: () => <Queue handlers={CLEAR} />,
    },
    "not-staff": {
      description:
        "A signed-in person without the mandate. The door is visible and explains itself, instead of an operations error nobody can act on.",
      viewport: "phone",
      step: "forbidden",
      render: () => <Queue handlers={NOT_STAFF} />,
    },
    dlq: {
      description:
        "The second tab, seeded through `initialTab` so it can be photographed rather than clicked to. The header carries two numbers and not their sum: 15 waiting for a moderator, 3 nobody ever screened. Adding them is how a broken screening seam spent twelve days on a client stand looking like a busy queue.",
      viewport: "desktop",
      step: "dlq",
      render: () => <Queue handlers={PARKED} initialTab="dlq" />,
    },
  },
});
