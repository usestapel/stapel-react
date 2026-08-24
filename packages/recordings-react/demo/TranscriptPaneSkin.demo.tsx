/** Speaker-attributed segments, click-to-seek, aria-current on the line that is playing. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TranscriptPane } from "../src/default/index.js";
import { SkinDemo } from "./_fixtures.js";

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <TranscriptPane recordingId="rec-2" />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo handlers={{ "/transcript": { items: [], next_anchor: null, prev_anchor: null, has_next: false, has_prev: false, count: 0 } }}>
      <TranscriptPane recordingId="rec-1" isProcessing />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.transcript-skin",
  title: "Transcript pane",
  description:
    "A live region rather than a list: every segment is a real button that seeks the audio, and the playing line announces itself.",
  component: TranscriptPane,
  variants: {
    default: {
      description: "Three segments, one with no diarized speaker (the positional fallback).",
      viewport: "desktop",
      step: "ready",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "A recording still being transcribed: the empty arm says the transcript is coming, not that there is none.",
      viewport: "phone",
      step: "pending",
      render: () => <PhoneVariant />,
    },
  },
});
