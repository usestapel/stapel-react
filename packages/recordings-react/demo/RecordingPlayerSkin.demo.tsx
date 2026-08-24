/** Playback over a short-lived minted URL, with the three refusals rendered as three different sentences. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RecordingPlayer } from "../src/default/index.js";
import { DONE } from "./_fixtures.js";
import { SkinDemo } from "./_fixtures.js";

const UPLOADING = { ...DONE, id: "rec-3", status: "uploading" };

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingPlayer recording={DONE} />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingPlayer recording={UPLOADING} />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.player-skin",
  title: "Player",
  description:
    "The only path to the bytes: a minted URL that re-mints before it expires, and named arms for 'not stored' and 'delivery is down'.",
  component: RecordingPlayer,
  variants: {
    default: {
      description: "A finished recording, transport ready.",
      viewport: "desktop",
      step: "ready",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "A recording still uploading: no dead transport, a blocked control with its reason.",
      viewport: "phone",
      step: "blocked",
      render: () => <PhoneVariant />,
    },
  },
});
