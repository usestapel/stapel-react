/**
 * The staff triage table — and the 403 that is a person, not a fault.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DsarQueue } from "../src/default/admin/DsarQueue.js";
import { GdprDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DSAR_ACKNOWLEDGED,
  DSAR_ACK_OVERDUE,
  STAFF_ONLY,
} from "./_fixtures.js";

/** A quiet queue: everything acknowledged by the automation, as it should be. */
const QUIET: DemoHandlers = {
  "/dsar": [DSAR_ACKNOWLEDGED],
};

/** The finding: a row past its ack deadline with nothing sent means the
 * NOTIFICATION WIRING is broken, not that an operator was slow. */
const OVERDUE: DemoHandlers = {
  "/dsar": [DSAR_ACK_OVERDUE, DSAR_ACKNOWLEDGED],
};

/** Nothing in the queue — the good empty, said out loud. */
const EMPTY: DemoHandlers = {
  "/dsar": [],
};

/** A signed-in person who is not staff. `GET /dsar` is AllowAny at the view
 * level (the POST beside it must accept an anonymous form), so its staff check
 * answers a generic 403 — which this screen names instead of rendering an
 * operations failure at somebody who simply used the wrong account. */
const NOT_STAFF: DemoHandlers = {
  "/dsar": STAFF_ONLY,
};

function Queue(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <GdprDemoHarness handlers={props.handlers}>
      <DsarQueue />
    </GdprDemoHarness>
  );
}

export default defineDemo({
  id: "gdpr.dsar-queue",
  title: "Data-protection requests (staff)",
  description:
    "Two deadlines, and one of them means the machine broke: `ack_due_at` is three BUSINESS days and the acknowledgement is AUTOMATED, so a row past it with no `ack_sent_at` is a broken notification path, not a slow operator — the same finding `gdpr.W008` raises at boot, here on the screen where somebody can act on it. The triage save is gated rather than merely greyed: a draft equal to the stored note would write an audit-trail edit that edited nothing, and the reason says so beside the control.",
  component: DsarQueue,
  tokens: ["surface-raised", "error", "warning"],
  variants: {
    default: {
      description: "One acknowledged request, with the date the automation sent it.",
      viewport: "phone",
      step: "acknowledged",
      render: () => <Queue handlers={QUIET} />,
    },
    "ack-overdue": {
      description:
        "Past the statutory acknowledgement deadline with nothing sent — raised as its own banner.",
      viewport: "desktop",
      step: "ack_overdue",
      render: () => <Queue handlers={OVERDUE} />,
    },
    empty: {
      description: "No requests — said, not left blank.",
      viewport: "phone",
      step: "empty",
      render: () => <Queue handlers={EMPTY} />,
    },
    "not-staff": {
      description:
        "The door is visible and explains itself: the nav axis has no 'staff' value, so the screen does the explaining.",
      viewport: "phone",
      step: "forbidden",
      render: () => <Queue handlers={NOT_STAFF} />,
    },
  },
});
