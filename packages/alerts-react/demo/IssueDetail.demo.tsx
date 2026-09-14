/**
 * One issue: everything the store knows, and the judgements an operator can
 * record about it.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { IssueDetail, MuteIssueDialog } from "../src/default/index.js";
import { AlertsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  FATAL,
  FATAL_DETAIL,
  FIXED,
  FIXED_DETAIL,
  REGRESSED,
  REGRESSED_DETAIL,
} from "./_fixtures.js";

const OPEN: DemoHandlers = { "/issues/": FATAL_DETAIL };
const CAME_BACK: DemoHandlers = { "/issues/": REGRESSED_DETAIL };
const SWEPT: DemoHandlers = { "/issues/": FIXED_DETAIL };

function Detail(props: {
  handlers: DemoHandlers;
  issueId: string;
}): ReactElement {
  return (
    <AlertsDemoHarness handlers={props.handlers}>
      <IssueDetail issueId={props.issueId} />
    </AlertsDemoHarness>
  );
}

/** The mute dialog, open, on the issue somebody has decided to park. */
function Mute(): ReactElement {
  return (
    <AlertsDemoHarness handlers={OPEN}>
      <MuteIssueDialog
        open
        onClose={() => undefined}
        issueId={FATAL.id}
        level={FATAL.level}
      />
    </AlertsDemoHarness>
  );
}

export default defineDemo({
  id: "alerts.issue",
  title: "Issue",
  description:
    "The occurrences are a sample and the count is the fact, so the heading states the relationship rather than leaving a list of twenty next to a count of four hundred looking like a contradiction. Each occurrence is collapsed over its own traceback and its own redacted context, because sixty frames inline would put every control on this screen below the fold. `Came back` is reported, never offered: the store sets it when a closed issue receives a new event, and the notice names the release that was supposed to have stopped it. `Muted until` is drawn only while the issue IS muted — the store does not clear the field when the status moves on.",
  component: IssueDetail,
  covers: ["MuteIssueDialog"],
  tokens: ["error", "warning", "success", "text-muted"],
  variants: {
    default: {
      description:
        "An open fatal with three occurrences — one of them carrying no traceback at all, which is what a captured log record looks like.",
      viewport: "desktop",
      step: "open",
      render: () => <Detail handlers={OPEN} issueId={FATAL.id} />,
    },
    phone: {
      description: "390px: the meta wraps, the tracebacks keep their own scroll.",
      viewport: "phone",
      step: "open-phone",
      render: () => <Detail handlers={OPEN} issueId={FATAL.id} />,
    },
    "came-back": {
      description:
        "Closed in 0.41.0 and failing again since. The notice names the release, because that is what somebody needs in order to act — not the status word.",
      viewport: "desktop",
      step: "regressed",
      render: () => <Detail handlers={CAME_BACK} issueId={REGRESSED.id} />,
    },
    swept: {
      description:
        "Closed long enough ago that retention took the events. The row survives: deleting it would turn “unresolved” into “never happened”.",
      viewport: "desktop",
      step: "swept",
      render: () => <Detail handlers={SWEPT} issueId={FIXED.id} />,
    },
    mute: {
      description:
        "Muting stops the notifications, not the recording — the first line of the dialog, because that is the thing people get wrong about a mute. “No deadline” is offered last and warned about.",
      viewport: "phone",
      step: "mute",
      render: () => <Mute />,
    },
  },
});
