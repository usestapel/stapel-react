/** The share's own shorter-lived media URL — it leaves the trust boundary, so it expires sooner. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SharedMedia } from "../src/default/index.js";
import { MEDIA } from "./_fixtures.js";
import { SkinDemo } from "./_fixtures.js";

const GRANTED = {
  state: { status: "ready", data: MEDIA } as const,
  granted: true,
  refresh: (): void => undefined,
};

const NOT_GRANTED = {
  state: { status: "loading" } as const,
  granted: false,
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
  },
});
