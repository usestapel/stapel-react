/**
 * The two intakes that had a typed endpoint and no widget.
 *
 * `POST /upload/video/` and `POST /upload/file/` shipped in stapel-cdn and were
 * documented in this pair as "no hook and no widget over it" — the §83 class,
 * and the reason `duration_ms`, `poster_url` and the waveform half of the
 * render metadata had no possible consumer. One component with two arms,
 * because a video and a document differ only in the ceilings they are validated
 * against, the `accept` they offer, and what the result looks like when it
 * lands — and all three of those are already data.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MediaUploadField } from "../src/default/index.js";
import { CdnDemoHarness, DEMO_MISS } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import type { MediaUploadKind } from "../src/default/index.js";

const HANDLERS: DemoHandlers = {
  "/file/exists/": DEMO_MISS,
};

function Field(props: { kind: MediaUploadKind }): ReactElement {
  return (
    <CdnDemoHarness handlers={HANDLERS}>
      <MediaUploadField kind={props.kind} />
    </CdnDemoHarness>
  );
}

export default defineDemo({
  id: "cdn.media-intake",
  title: "Video and document intake",
  description:
    "The same control over the two non-image endpoints. The `accept` string is built from the deployment's own allowlist — the same one the client-side refusal is built from — so the picker and the gate cannot disagree, and the ceilings that apply are the ones for THIS intake (100 MB for a clip, 50 MB for a document), not the image ones.",
  component: MediaUploadField,
  tokens: ["border-subtle", "surface-sunken"],
  variants: {
    video: {
      description: "100 MB, five container extensions, and a poster when it lands.",
      viewport: "phone",
      step: "video-idle",
      render: () => <Field kind="video" />,
    },
    document: {
      description:
        "50 MB, and the one intake that narrows on MIME as well as extension — deliberately without `application/octet-stream`.",
      viewport: "desktop",
      step: "file-idle",
      render: () => <Field kind="file" />,
    },
  },
});
