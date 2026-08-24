/** The anonymous surface: no session, and every part gated on the link's own grants. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SharedRecordingView } from "../src/default/index.js";
import { MEDIA, SHARED_FULL, SHARED_VIEW_ONLY } from "./_fixtures.js";
import { SkinDemo } from "./_fixtures.js";

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo handlers={{ "/shares/tok/media": MEDIA, "/shares/tok": SHARED_FULL }}>
      <SharedRecordingView linkToken="tok" />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo handlers={{ "/shares/tok": SHARED_VIEW_ONLY }}>
      <SharedRecordingView linkToken="tok" />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.share-skin",
  title: "Public share page",
  description:
    "A share link renders what it grants and nothing else — a view-only link never puts up a player that cannot play.",
  component: SharedRecordingView,
  covers: ["SharedRecording"],
  variants: {
    default: {
      description: "A link granting everything: media, transcript and summary.",
      viewport: "desktop",
      step: "full",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "A view-only link at 390px: the details, and the sentence saying the rest is not included.",
      viewport: "phone",
      step: "view-only",
      render: () => <PhoneVariant />,
    },
  },
});
