/**
 * The complaint form and the four things it can be while somebody looks at it.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReportSheet } from "../src/default/index.js";
import { ModerationDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { POLICY, POLICY_EMPTY, POLICY_NO_AUTOMATION } from "./_fixtures.js";

function Sheet(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <ModerationDemoHarness handlers={props.handlers}>
      <ReportSheet
        open
        onClose={() => {}}
        targetType="listing"
        targetKey="8842"
        signIn={{ href: "/login" }}
      />
    </ModerationDemoHarness>
  );
}

export default defineDemo({
  id: "moderation.report-sheet",
  title: "Report sheet",
  description:
    "A bottom sheet on a phone and a modal above it, from the shared dialog rule. The description box is always visible and only its REQUIREMENT changes with the reason — a box that materialises under the radio somebody just tapped moves the submit out from under their thumb. The automated-screening line is Art. 15(1)(e) transparency and is rendered from the policy, so a deployment with its screener off simply does not show it. There is no evidence field: the one consumer stopped registering evidence-based target types in 0.3.x, and the moderator reads the message itself on the case card.",
  component: ReportSheet,
  tokens: ["surface-raised", "border", "text-muted"],
  variants: {
    default: {
      description:
        "Three reasons, one of which demands an explanation, plus the screening notice.",
      viewport: "phone",
      step: "choosing_reason",
      render: () => <Sheet handlers={{ "/policy": POLICY }} />,
    },
    "no-automation": {
      description:
        "A deployment that screens nothing: the notice is absent because the claim would be false, not because the copy was removed.",
      viewport: "desktop",
      step: "no_automation",
      render: () => <Sheet handlers={{ "/policy": POLICY_NO_AUTOMATION }} />,
    },
    "no-reasons": {
      description:
        "A registry with nothing in it — said out loud, rather than an empty radio group.",
      viewport: "phone",
      step: "empty_policy",
      render: () => <Sheet handlers={{ "/policy": POLICY_EMPTY }} />,
    },
    "policy-failed": {
      description:
        "The rules could not be read. The form is not drawn from a failed load: an empty list and a broken list are different, and only one of them means 'nothing can be reported'.",
      viewport: "phone",
      step: "policy_failed",
      render: () => <Sheet handlers={{ "/policy": [503, {}] }} />,
    },
  },
});
