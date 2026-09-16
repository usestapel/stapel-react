/** Everything that happens after processing finishes: play it, read it, re-summarize it, re-run it. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { RecordingDetailPane } from "../src/default/index.js";
import { RECORDINGS_I18N_KEYS } from "../src/index.js";
import { NEEDS_PAYMENT_HANDLERS, SkinDemo } from "./_fixtures.js";

/** Stands in for the host's route to billing — the slot both notices leave open. */
function TopUpLink(): ReactElement {
  const t = useT();
  return <a href="#billing">{t(RECORDINGS_I18N_KEYS.paymentAction)}</a>;
}

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

function NeedsPaymentVariant(): ReactElement {
  return (
    <SkinDemo handlers={NEEDS_PAYMENT_HANDLERS}>
      <RecordingDetailPane recordingId="rec-3" renderTopUpAction={<TopUpLink />} />
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
    needsPayment: {
      description:
        "status === \"needs_payment\": the reason-specific top-up prompt in place of the generic chip a parked recording rendered as before this pin bumped to stapel-recordings 0.25.0.",
      viewport: "desktop",
      step: "needs-payment",
      render: () => <NeedsPaymentVariant />,
    },
  },
});
