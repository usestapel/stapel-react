/**
 * The microphone.
 *
 * A voice message is the one attachment a person MAKES rather than picks, and
 * until this control existed the waveform half of the render metadata
 * (`preview_kind: "waveform"`, the `showwavespic` strip stapel-cdn generates in
 * the same pass as everything else) had no possible producer in a browser.
 *
 * The two variants are the two interactions, and they are not a style choice:
 * `toggle` is the only shape that can be operated with no pointer at all, and
 * `hold` is the phone idiom layered on top of it rather than in place of it —
 * a keyboard activation still toggles. A hold-only control is a record button
 * no keyboard can press.
 *
 * A page that cannot record at all (an insecure origin, an engine with no
 * `MediaRecorder`) is not a third variant here: it is what these two render as
 * outside a secure browser context, with the reason in place of the hint.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { VoiceRecordButton } from "../src/default/index.js";
import type { VoiceInteraction } from "../src/default/index.js";
import { CdnDemoHarness } from "./_harness.js";

/** Two minutes: long enough for a real message, short of the 50 MB ceiling. */
const MAX_MS = 120_000;

function Recorder(props: { interaction: VoiceInteraction }): ReactElement {
  return (
    <CdnDemoHarness handlers={{}}>
      <VoiceRecordButton
        interaction={props.interaction}
        maxMs={MAX_MS}
        onRecorded={() => {
          // A demo takes the clip and drops it: uploading and sending belong to
          // the consuming module, which is the whole point of this component
          // handing back a Blob rather than a reference.
        }}
      />
    </CdnDemoHarness>
  );
}

export default defineDemo({
  id: "cdn.voice",
  title: "Voice recording",
  description:
    "Record a voice message and hand the clip over. The container is chosen against the engine's own isTypeSupported — Opus in webm or ogg, AAC in mp4 on WebKit — because that string decides the file extension and the extension is what the CDN's intake allowlist reads. The clock is measured, the level meter is real or absent (never a bar that never moves), and the six ways a microphone can be unavailable are six sentences with four different next actions.",
  component: VoiceRecordButton,
  tokens: ["brand", "surface-sunken"],
  variants: {
    toggle: {
      description:
        "Press to start, press to stop. The one shape that works from a keyboard and a screen reader.",
      viewport: "desktop",
      step: "idle",
      render: () => <Recorder interaction="toggle" />,
    },
    hold: {
      description:
        "The phone idiom — hold to record, release to attach — with the toggle still underneath it for anyone without a pointer.",
      viewport: "phone",
      step: "idle",
      render: () => <Recorder interaction="hold" />,
    },
  },
});
