/** The three calls as ONE surface, with a real file picker, a title, a source, a diarization switch and a progress bar. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RecordingUploader } from "../src/default/index.js";
import { SkinDemo } from "./_fixtures.js";

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingUploader workspaceId="ws-1" />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingUploader />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.uploader-skin",
  title: "Uploader (create → upload → finalize)",
  description:
    "One surface for the whole upload act, so a half-uploaded recording cannot be stranded between three host-wired controls.",
  component: RecordingUploader,
  covers: ["RecordingUpload"],
  variants: {
    default: {
      description: "Ready to pick a file, inside a workspace.",
      viewport: "desktop",
      step: "idle",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "At 390px with no workspace: the start button is blocked and says why, beside it.",
      viewport: "phone",
      step: "blocked",
      render: () => <PhoneVariant />,
    },
  },
});
