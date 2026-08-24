/** The user's own cheap verb, with the 202 receipt and the 402 top-up prompt. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ResummarizeAction } from "../src/default/index.js";
import { DONE, PROCESSING } from "./_fixtures.js";
import { SkinDemo } from "./_fixtures.js";

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <ResummarizeAction recording={DONE} />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <ResummarizeAction recording={PROCESSING} />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.resummarize-skin",
  title: "Rewrite summary",
  description:
    "Accepted is not finished: the 202 receipt keeps the control blocked so a double click reads as one action, and a 402 becomes a top-up prompt.",
  component: ResummarizeAction,
  variants: {
    default: {
      description: "Available — the recording has a transcript.",
      viewport: "desktop",
      step: "available",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "Blocked at 390px: nothing to summarize yet, with the reason beside the button.",
      viewport: "phone",
      step: "blocked",
      render: () => <PhoneVariant />,
    },
  },
});
