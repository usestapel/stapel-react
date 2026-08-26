/** The shipped recordings screen. Rows carry the title, the date, the length and a status pill whose colour encodes the state; the list polls itself while any row is mid-pipeline. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RecordingsList } from "../src/default/index.js";
import { SkinDemo } from "./_fixtures.js";

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingsList />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo handlers={{ "/recordings": [] }}>
      <RecordingsList />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.list-skin",
  title: "Recordings screen (default skin)",
  description:
    "The shipped list: real RecordingStatus pills, dates and lengths through the locale formatters, and a failed arm that never wears the empty copy.",
  component: RecordingsList,
  // The list screen IS the headless `RecordingList` with a skin on it, and it
  // mounts the provider that wires the runtime. Both used to have `state.step`
  // chip-dump demos of their own, which photographed the harness instead of
  // the product (visual pass N-4).
  covers: ["RecordingList", "RecordingsProvider"],
  variants: {
    default: {
      description: "Two recordings: one still transcribing, one finished.",
      viewport: "desktop",
      step: "ready",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "The designed empty state at 390px — the first-run screen, with the create slot unfilled.",
      viewport: "phone",
      step: "empty",
      render: () => <PhoneVariant />,
    },
  },
});
