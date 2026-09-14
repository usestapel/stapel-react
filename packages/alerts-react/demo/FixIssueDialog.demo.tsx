/**
 * Closing an issue with the release that claims the fix.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FixIssueDialog } from "../src/default/index.js";
import { AlertsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { FATAL, FATAL_DETAIL } from "./_fixtures.js";

const READY: DemoHandlers = { "/issues/": FATAL_DETAIL };

function Dialog(): ReactElement {
  return (
    <AlertsDemoHarness handlers={READY}>
      <FixIssueDialog
        open
        onClose={() => undefined}
        issueId={FATAL.id}
        level={FATAL.level}
      />
    </AlertsDemoHarness>
  );
}

export default defineDemo({
  id: "alerts.fix",
  title: "Mark fixed",
  description:
    "Both fields are optional upstream and both are recorded, so the submit is never blocked — a CI caller has a sha, somebody closing a hotfix by hand may have only a version, and somebody closing a duplicate has neither. What the dialog does instead of refusing is state the cost while both are empty: the issue still closes, there is just nothing to point at the day the store reopens it. This posts to /issues/{id}/fix rather than patching the status, because only that endpoint records the release AND zeroes the since-the-fix counter, which is the entire answer to “did it come back?”.",
  component: FixIssueDialog,
  variants: {
    default: {
      description:
        "Both fields empty — the consequence is stated, and the button still works.",
      viewport: "desktop",
      step: "blank",
      render: () => <Dialog />,
    },
    phone: {
      description:
        "390px: a bottom sheet, with the action bar pinned so “Mark fixed” is never below the fold.",
      viewport: "phone",
      step: "sheet",
      render: () => <Dialog />,
    },
  },
});
