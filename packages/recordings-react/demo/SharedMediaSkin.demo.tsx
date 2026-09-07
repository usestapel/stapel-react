/** The share's own shorter-lived media URL — it leaves the trust boundary, so it expires sooner. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SharedMedia } from "../src/default/index.js";
import { MEDIA } from "./_fixtures.js";
import { SkinDemo } from "./_fixtures.js";

const GRANTED = {
  state: { status: "ready", data: MEDIA } as const,
  granted: true,
  isConverting: false,
  refresh: (): void => undefined,
};

const NOT_GRANTED = {
  state: { status: "loading" } as const,
  granted: false,
  isConverting: false,
  refresh: (): void => undefined,
};

/** The share opened while the pipeline is still extracting the audio: the read
 * answered 409, and a visitor is told to wait rather than told the link is
 * empty. */
const CONVERTING = {
  state: {
    status: "failed",
    error: { code: "error.409.recording_media_not_stored", message: "not stored" },
  } as const,
  granted: true,
  isConverting: true,
  refresh: (): void => undefined,
};

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <SharedMedia media={GRANTED} />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <SharedMedia media={NOT_GRANTED} />
    </SkinDemo>
  );
}

function ConvertingVariant(): ReactElement {
  return (
    <SkinDemo>
      <SharedMedia media={CONVERTING} />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.shared-media-skin",
  title: "Shared playback",
  description:
    "Playback on the public surface, refreshed on the share's shorter TTL, and absent entirely when the link does not grant media.",
  component: SharedMedia,
  variants: {
    default: {
      description: "A link that grants media.",
      viewport: "desktop",
      step: "granted",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "A link that does not grant media: the sentence, and no transport.",
      viewport: "phone",
      step: "not-granted",
      render: () => <PhoneVariant />,
    },
    converting: {
      description:
        "The audio has not been extracted yet: a wait, not the empty-link sentence and not a red box.",
      viewport: "desktop",
      step: "waiting",
      render: () => <ConvertingVariant />,
    },
  },
});
