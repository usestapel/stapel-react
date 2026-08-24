/**
 * `<Price>` in its four situations — and the point is that the seller's own
 * number is on screen in all four.
 *
 * The converted line is the only thing that ever waits, degrades or disappears.
 * A price that could not be converted still shows the price.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { Price } from "../src/default/Price.js";
import {
  CurrenciesDemoHarness,
  DemoCard,
  HANDLERS_EMPTY,
  HANDLERS_READY,
} from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

function Framed(props: {
  handlers: DemoHandlers;
  currency: string;
  display: string;
  showRate?: boolean;
}): ReactElement {
  return (
    <CurrenciesDemoHarness handlers={props.handlers}>
      <DemoCard heading="Price">
        <Price
          amount="1500.00"
          currency={props.currency}
          displayCurrency={props.display}
          {...(props.showRate === true ? { showRate: true } : {})}
        />
      </DemoCard>
    </CurrenciesDemoHarness>
  );
}

export default defineDemo({
  id: "currencies.price",
  title: "Price (default skin)",
  description:
    "A price in the currency it is quoted in, with an optional estimate under it. The estimate is never shown alone: the catalogue serves no rate timestamp, so the seller's own number stays the number on screen.",
  component: Price,
  variants: {
    default: {
      description: "Converted: EUR price, USD viewer. The estimate is marked as one.",
      viewport: "phone",
      step: "converted",
      render: () => <Framed handlers={HANDLERS_READY} currency="EUR" display="USD" />,
    },
    same: {
      description:
        "The display currency IS the price's currency — no second line, no conversion.",
      viewport: "phone",
      step: "same-currency",
      render: () => <Framed handlers={HANDLERS_READY} currency="USD" display="USD" />,
    },
    rate: {
      description:
        "showRate: the rate as VISIBLE text, not a tooltip. A hover explanation does not exist on the device most prices are read on.",
      viewport: "desktop",
      step: "rate-visible",
      render: () => (
        <Framed handlers={HANDLERS_READY} currency="RUB" display="USD" showRate />
      ),
    },
    unavailable: {
      description:
        "The catalogue is configured with nothing, so no rate exists. The price still renders; the estimate says it is unavailable rather than showing a blank.",
      viewport: "phone",
      step: "unavailable",
      render: () => <Framed handlers={HANDLERS_EMPTY} currency="EUR" display="USD" />,
    },
  },
});
