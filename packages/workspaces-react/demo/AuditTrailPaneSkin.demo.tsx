/**
 * THE DEFAULT SKIN, IN THE VIEWER — the membership history as it ships.
 *
 * Every line is a sentence: the closed `AuditAction` vocabulary rendered as
 * words, the actor named (or "The system" for a transition nobody performed —
 * the `require_mfa` sweep), and timestamps as "3 days ago (22 Aug 2026)"
 * rather than the ISO string the wire carries.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AuditTrailPane } from "../src/default/AuditTrailPane.js";
import { WorkspacesDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { AUDIT_EMPTY_HANDLERS, AUDIT_HANDLERS, DEMO_WS } from "./skinFixtures.js";

function Trail(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={props.handlers}>
      <AuditTrailPane workspaceId={DEMO_WS} />
    </WorkspacesDemoHarness>
  );
}

export default defineDemo({
  id: "workspaces.audit-trail",
  title: "Membership history (default skin)",
  description:
    "The shipped audit trail: who let this person in, who took them out and when, filtered by action from the closed backend vocabulary, walked by anchor. An action the client does not know is title-cased from its key — never a dotted i18n key on the glass.",
  component: AuditTrailPane,
  variants: {
    default: {
      description:
        "An invitation, a join, a promotion, and a suspension nobody performed — the policy sweep, attributed to the system.",
      step: "history",
      render: () => <Trail handlers={AUDIT_HANDLERS} />,
    },
    empty: {
      description: "A workspace where nothing has happened yet.",
      step: "empty",
      viewport: "phone",
      render: () => <Trail handlers={AUDIT_EMPTY_HANDLERS} />,
    },
  },
});
