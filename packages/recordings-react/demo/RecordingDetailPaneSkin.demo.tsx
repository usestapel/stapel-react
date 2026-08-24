/** Everything that happens after processing finishes: play it, read it, re-summarize it, re-run it. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RecordingDetailPane } from "../src/default/index.js";
import { SkinDemo } from "./_fixtures.js";

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingDetailPane recordingId="rec-2" />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingDetailPane recordingId="rec-2" summariesUnavailable />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.detail-skin",
  title: "Recording screen (default skin)",
  description:
    "The recording screen: facts through the locale formatters, the player, the summary, the synced transcript, and the two metered actions with their reasons.",
  component: RecordingDetailPane,
  covers: ["RecordingDetail", "RecordingMedia", "Transcript", "ResummarizeControl", "ReprocessControl"],
  variants: {
    default: {
      description: "A finished recording with a transcript and a summary.",
      viewport: "desktop",
      step: "ready",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "At 390px — the same screen stacked, with 44px controls inherited from SkinTheme.",
      viewport: "phone",
      step: "ready-phone",
      render: () => <PhoneVariant />,
    },
  },
});
