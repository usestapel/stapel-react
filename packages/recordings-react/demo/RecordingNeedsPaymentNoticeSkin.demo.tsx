/** A recording's OWN park (status === "needs_payment"), rendered as a reason-specific top-up prompt. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { RecordingNeedsPaymentNotice } from "../src/default/index.js";
import { RECORDINGS_I18N_KEYS } from "../src/index.js";
import { SkinDemo } from "./_fixtures.js";

/** Stands in for the host's route to billing — the slot this notice leaves open. */
function TopUpLink(): ReactElement {
  const t = useT();
  return <a href="#billing">{t(RECORDINGS_I18N_KEYS.paymentAction)}</a>;
}

function InsufficientCreditsVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingNeedsPaymentNotice
        reason="insufficient_credits"
        renderTopUpAction={<TopUpLink />}
      />
    </SkinDemo>
  );
}

function FreeMinutesExhaustedVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingNeedsPaymentNotice
        reason="free_minutes_exhausted"
        renderTopUpAction={<TopUpLink />}
      />
    </SkinDemo>
  );
}

function UnknownReasonVariant(): ReactElement {
  return (
    <SkinDemo>
      <RecordingNeedsPaymentNotice reason="quantum-overdraft" />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.needs-payment-skin",
  title: "Recording parked on payment",
  description:
    "A recording's own park (stapel-recordings 0.25.0), not a mutation's 402 refusal — the reason names why in words, and a reason this build has never seen still gets a sentence rather than a raw key.",
  component: RecordingNeedsPaymentNotice,
  variants: {
    default: {
      description: "insufficient_credits — the balance ran out partway through.",
      viewport: "desktop",
      step: "insufficient-credits",
      render: () => <InsufficientCreditsVariant />,
    },
    freeMinutes: {
      description: "free_minutes_exhausted — the period's free allowance is spent.",
      viewport: "desktop",
      step: "free-minutes-exhausted",
      render: () => <FreeMinutesExhaustedVariant />,
    },
    phone: {
      description:
        "At 390px, with a reason code this build does not recognize and the slot unfilled — the generic fallback sentence, never the raw code.",
      viewport: "phone",
      step: "unknown-reason",
      render: () => <UnknownReasonVariant />,
    },
  },
});
