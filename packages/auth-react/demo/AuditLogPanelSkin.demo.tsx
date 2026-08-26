/**
 * The account's own security log.
 *
 * Two things the visual pass changed here are visible in these shots: the
 * timestamp is formatted in the APP's locale (not the browser's), and the
 * "suspicious" marker is a chip carrying the words — it used to be a bare
 * exclamation mark, which is a glyph a screen reader announces as nothing on
 * the row that matters most.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AuditLogPanel } from "../src/default/security/AuditLogPanel.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { AUDIT_EMPTY, AUDIT_PAGE } from "./fixtures.js";

const PAGE: DemoHandlers = { "/security/audit/": AUDIT_PAGE };
const EMPTY: DemoHandlers = { "/security/audit/": AUDIT_EMPTY };
const FAILED: DemoHandlers = {
  "/security/audit/": [500, { localizable_error: "error.500.internal" }],
};

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <AuditLogPanel />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.audit-log-skin",
  title: "Security log (default skin)",
  description:
    "Recent activity on this account, newest first, a page at a time. Unrecognized activity carries a named chip; dates are formatted in the app's locale, not the browser's.",
  component: AuditLogPanel,
  variants: {
    default: {
      description: "A sign-in, an unrecognized sign-in, and a passkey rename.",
      step: "ready",
      viewport: "phone",
      render: () => <Panel handlers={PAGE} />,
    },
    empty: {
      description: "A new account with no history — stated, with what will appear here.",
      step: "empty",
      render: () => <Panel handlers={EMPTY} />,
    },
    failed: {
      description: "The read fails: the refusal is stated with a retry, never an empty log.",
      step: "failed",
      render: () => <Panel handlers={FAILED} />,
    },
  },
});
