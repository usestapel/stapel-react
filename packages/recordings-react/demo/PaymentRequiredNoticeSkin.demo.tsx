/** error.402.recording_payment_required, rendered as the thing the backend designed it to become. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PaymentRequiredNotice } from "../src/default/index.js";
import { useT } from "@stapel/core";
import { RECORDINGS_I18N_KEYS } from "../src/index.js";
import { SkinDemo } from "./_fixtures.js";

/** Stands in for the host's route to billing — the slot this notice leaves open. */
function TopUpLink(): ReactElement {
  const t = useT();
  return <a href="#billing">{t(RECORDINGS_I18N_KEYS.paymentAction)}</a>;
}

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <PaymentRequiredNotice renderTopUpAction={<TopUpLink />} />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <PaymentRequiredNotice />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.payment-skin",
  title: "Out of credit",
  description:
    "The metered refusal as a top-up prompt; where the money is added is a host slot, visible and named in development when unfilled.",
  component: PaymentRequiredNotice,
  variants: {
    default: {
      description: "With the host's top-up route filled in.",
      viewport: "desktop",
      step: "filled",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "At 390px with the slot unfilled — a named box in development, nothing in production.",
      viewport: "phone",
      step: "unfilled",
      render: () => <PhoneVariant />,
    },
  },
});
