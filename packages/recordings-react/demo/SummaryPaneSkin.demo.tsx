/** The LLM summary, and the deployment axis that makes the pane not exist at all. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SummaryPane } from "../src/default/index.js";
import { DONE, PROCESSING } from "./_fixtures.js";
import { SkinDemo } from "./_fixtures.js";

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <SummaryPane recording={DONE} />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <SummaryPane recording={PROCESSING} />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.summary-skin",
  title: "Summary pane",
  description:
    "The summary with its rewrite action; when the deployment has summaries switched off the pane is absent rather than an empty card.",
  component: SummaryPane,
  variants: {
    default: {
      description: "A summary, with the rewrite action beside the heading.",
      viewport: "desktop",
      step: "ready",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "A recording with no summary yet: a designed empty state, not a blank card.",
      viewport: "phone",
      step: "empty",
      render: () => <PhoneVariant />,
    },
  },
});
