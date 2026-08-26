/**
 * The global security stream — every account's events, not just one person's.
 *
 * Filters are COMMITTED, not live. A filter set is a cache key, so applying
 * on every keystroke would be one request per character and a page number
 * that means nothing between them; pressing Apply is what makes a read, and
 * it resets to page 1 because a page number from a different filter set is a
 * different page.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AdminAuditPanel } from "../src/default/admin/AdminAuditPanel.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  ADMIN_HANDLERS,
  ADMIN_HANDLERS_EMPTY,
  ADMIN_HANDLERS_FORBIDDEN,
} from "./fixtures.js";

function Screen(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <AdminAuditPanel />
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.admin-audit-skin",
  title: "Audit log (operator console)",
  description:
    "Security activity across every account, newest first, filtered by event type, account and date range. Unrecognized activity carries a named chip; dates are formatted in the operator's app locale.",
  component: AdminAuditPanel,
  variants: {
    default: {
      description: "42 events, the first page, with the filters unset.",
      step: "ready",
      render: () => <Screen handlers={ADMIN_HANDLERS} />,
    },
    "no-matches": {
      description:
        "The filters match nothing. The empty state says what to do about it — widen the dates, or clear them.",
      step: "empty",
      viewport: "phone",
      render: () => <Screen handlers={ADMIN_HANDLERS_EMPTY} />,
    },
    forbidden: {
      description: "The read is refused, stated as a refusal rather than a quiet empty log.",
      step: "forbidden",
      render: () => <Screen handlers={ADMIN_HANDLERS_FORBIDDEN} />,
    },
  },
});
