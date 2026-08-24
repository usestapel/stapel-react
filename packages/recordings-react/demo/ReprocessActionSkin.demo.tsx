/** The staff-shaped verb, confirmed in a dialog that names the cost. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReprocessAction } from "../src/default/index.js";
import { DONE, PROCESSING } from "./_fixtures.js";
import { SkinDemo } from "./_fixtures.js";

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <ReprocessAction recording={DONE} />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <ReprocessAction recording={PROCESSING} />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.reprocess-skin",
  title: "Transcribe again",
  description:
    "A second transcription and a second bill, so it goes through the fleet's confirm surface — a bottom sheet on a phone, a modal above 768px.",
  component: ReprocessAction,
  variants: {
    default: {
      description: "Available on a finished recording.",
      viewport: "desktop",
      step: "available",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "Blocked at 390px: only a finished recording can be re-run, and the button says so.",
      viewport: "phone",
      step: "blocked",
      render: () => <PhoneVariant />,
    },
  },
});
