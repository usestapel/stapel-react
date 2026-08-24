/**
 * Every declared data owner, and whether it is answering — the table whose
 * whole point is that a silent system is a ROW, not an absence.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { OwnersHealth } from "../src/default/admin/OwnersHealth.js";
import { GdprDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  OWNER_ALIVE,
  OWNER_MISMATCHED,
  OWNER_SILENT,
  STAFF_ONLY,
} from "./_fixtures.js";

/** Everything answering, for the subjects it declares. */
const HEALTHY: DemoHandlers = {
  "/owners/health": [OWNER_ALIVE],
};

/** The finding this table exists for: one system declared, deployed and never
 * once answering, plus one answering for fewer subjects than it declares. */
const SILENT: DemoHandlers = {
  "/owners/health": [OWNER_ALIVE, OWNER_SILENT, OWNER_MISMATCHED],
};

/** No owner declared at all — the emptiest table on this screen is its worst
 * finding: nothing would receive an erasure. */
const NONE: DemoHandlers = {
  "/owners/health": [],
};

/** Signed in, not staff. */
const NOT_STAFF: DemoHandlers = {
  "/owners/health": STAFF_ONLY,
};

function Table(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <GdprDemoHarness handlers={props.handlers}>
      <OwnersHealth />
    </GdprDemoHarness>
  );
}

export default defineDemo({
  id: "gdpr.owners-health",
  title: "Data owners (staff)",
  description:
    "The table is built from the INVENTORY, not from the answers, so a system that never replies appears as a red row saying 'silent' instead of vanishing from a list that then looks perfectly healthy. That inversion is the defect the probe machinery exists to fix: seven owners in a running product had never started their subscriber, and the only trace was an erasure sitting `queued` until a sweep marked it `timeout`. `alive` is the SERVER's bit — nothing here re-derives liveness from a timestamp and a guess at the threshold.",
  component: OwnersHealth,
  tokens: ["surface-raised", "success", "error", "warning"],
  variants: {
    default: {
      description: "One owner, answering, for exactly the subjects it declares.",
      viewport: "phone",
      step: "healthy",
      render: () => <Table handlers={HEALTHY} />,
    },
    silent: {
      description:
        "A system that has never answered, and one answering for fewer subjects than it declares — both rows, both named.",
      viewport: "desktop",
      step: "silent",
      render: () => <Table handlers={SILENT} />,
    },
    "none-declared": {
      description: "No owners at all: nothing would receive an erasure, said out loud.",
      viewport: "phone",
      step: "empty",
      render: () => <Table handlers={NONE} />,
    },
    "not-staff": {
      description: "The 403, named rather than rendered as an operations failure.",
      viewport: "phone",
      step: "forbidden",
      render: () => <Table handlers={NOT_STAFF} />,
    },
  },
});
