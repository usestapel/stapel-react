/**
 * The operations screen `admin.privacy` mounts: the DSAR queue over the
 * owner-health table, in the order of urgency.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PrivacyAdminPane } from "../src/default/admin/PrivacyAdminPane.js";
import { GdprDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DSAR_ACKNOWLEDGED,
  DSAR_ACK_OVERDUE,
  OWNER_ALIVE,
  OWNER_SILENT,
  STAFF_ONLY,
} from "./_fixtures.js";

/** A calm morning: everything acknowledged, every owner answering. */
const CALM: DemoHandlers = {
  "/owners/health": [OWNER_ALIVE],
  "/dsar": [DSAR_ACKNOWLEDGED],
};

/** The bad morning, and the reason both tables are one screen: a missed
 * acknowledgement and a silent owner are the same job — being able to prove,
 * afterwards, that the deletions happened. */
const TROUBLE: DemoHandlers = {
  "/owners/health": [OWNER_ALIVE, OWNER_SILENT],
  "/dsar": [DSAR_ACK_OVERDUE, DSAR_ACKNOWLEDGED],
};

/** Signed in with the wrong account: both surfaces say so by name. */
const NOT_STAFF: DemoHandlers = {
  "/owners/health": STAFF_ONLY,
  "/dsar": STAFF_ONLY,
};

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <GdprDemoHarness handlers={props.handlers}>
      <PrivacyAdminPane />
    </GdprDemoHarness>
  );
}

export default defineDemo({
  id: "gdpr.privacy-admin",
  title: "Privacy operations",
  description:
    "The screen `admin.privacy` mounts. The order is the order of urgency: a DSAR has a statutory clock and a named person waiting; a silent data owner is a slower fault that turns into missed erasure deadlines later. The nav axis has two values (public | member) and cannot say 'staff', so the door stays visible and BOTH surfaces name the 403 — a hidden control teaches nobody that they are signed in with the wrong account.",
  component: PrivacyAdminPane,
  tokens: ["surface", "surface-raised", "error", "warning"],
  variants: {
    default: {
      description: "Nothing overdue, every declared system answering.",
      viewport: "phone",
      step: "calm",
      render: () => <Pane handlers={CALM} />,
    },
    "overdue-and-silent": {
      description:
        "An acknowledgement the automation never sent, and a system that has never answered.",
      viewport: "desktop",
      step: "trouble",
      render: () => <Pane handlers={TROUBLE} />,
    },
    "not-staff": {
      description: "Both tables explain the refusal instead of showing an empty operations screen.",
      viewport: "phone",
      step: "forbidden",
      render: () => <Pane handlers={NOT_STAFF} />,
    },
  },
});
