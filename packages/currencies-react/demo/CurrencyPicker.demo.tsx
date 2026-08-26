/**
 * The picker's four states, and its two SURFACES.
 *
 * The phone variant is the one to look at: below the tablet breakpoint the
 * control is a button that opens a bottom sheet, because a 16-row native
 * dropdown anchored to a control near the bottom of a 390px screen is the
 * desktop-surface-on-phone defect.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CurrencyPicker } from "../src/default/CurrencyPicker.js";
import { useCurrencies } from "../src/index.js";
import {
  CurrenciesDemoHarness,
  DemoCard,
  HANDLERS_EMPTY,
  HANDLERS_FAILED,
  HANDLERS_READY,
} from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

function Picker(props: { defaultOpen?: boolean }): ReactElement {
  const { state, refetch } = useCurrencies();
  const [code, setCode] = useState("USD");
  return (
    <CurrencyPicker
      value={code}
      onChange={setCode}
      options={state}
      onRetry={refetch}
      {...(props.defaultOpen === true ? { defaultOpen: true } : {})}
    />
  );
}

function Framed(props: {
  handlers: DemoHandlers;
  defaultOpen?: boolean;
}): ReactElement {
  return (
    <CurrenciesDemoHarness handlers={props.handlers}>
      <DemoCard heading="CurrencyPicker">
        <Picker {...(props.defaultOpen === true ? { defaultOpen: true } : {})} />
      </DemoCard>
    </CurrenciesDemoHarness>
  );
}

export default defineDemo({
  id: "currencies.picker",
  title: "Currency picker (default skin)",
  description:
    "Choose the currency prices are shown in. A searchable Select on tablet and desktop; a bottom sheet with a real list on a phone. Loading disables the control WITH its reason beside it; an unconfigured catalogue says so; only a failed read is drawn as a failure.",
  component: CurrencyPicker,
  variants: {
    default: {
      description: "Desktop: a searchable Select — symbol, code and the translated name.",
      viewport: "desktop",
      step: "ready",
      render: () => <Framed handlers={HANDLERS_READY} />,
    },
    phone: {
      description:
        "390px: the sheet itself, open. A full-width list with rows on the touch floor — not a 16-row dropdown anchored to a control near the bottom of the screen.",
      viewport: "phone",
      step: "sheet",
      render: () => <Framed handlers={HANDLERS_READY} defaultOpen />,
    },
    "phone-closed": {
      description:
        "The same control before the sheet opens: a field with its label leading and a caret at the end, on the 44px touch floor.",
      viewport: "phone",
      step: "trigger",
      render: () => <Framed handlers={HANDLERS_READY} />,
    },
    empty: {
      description:
        "The deployment configured no currencies. That is a fact about the site, stated plainly — not an error.",
      viewport: "phone",
      step: "empty",
      render: () => <Framed handlers={HANDLERS_EMPTY} />,
    },
    failed: {
      description: "The catalogue read failed: the shared error surface, with a retry.",
      viewport: "phone",
      step: "failed",
      render: () => <Framed handlers={HANDLERS_FAILED} />,
    },
  },
});
