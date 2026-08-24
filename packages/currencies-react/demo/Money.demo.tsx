/**
 * The headless half: `<Money>` hands a bag to a render prop and draws nothing
 * itself. This is the layer a host with its own design system REPLACES — the
 * demo shows that the arithmetic and the locale rules survive the replacement.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { Money } from "../src/index.js";
import {
  CurrenciesDemoHarness,
  DemoCard,
  HANDLERS_READY,
  StepBadge,
} from "./_harness.js";

function Bag(props: { display: string }): ReactElement {
  return (
    <CurrenciesDemoHarness handlers={HANDLERS_READY}>
      <DemoCard heading="Money">
        <Money amount="1500.00" currency="EUR" displayCurrency={props.display}>
          {(bag) => (
            <div>
              <div>{bag.original}</div>
              <div>{bag.converted ?? "—"}</div>
              <StepBadge step={bag.state} />
            </div>
          )}
        </Money>
      </DemoCard>
    </CurrenciesDemoHarness>
  );
}

export default defineDemo({
  id: "currencies.money",
  title: "Money (render prop)",
  description:
    "The headless price bag: the original always present, the converted estimate optional, and the state that says which of the three situations the catalogue is in.",
  component: Money,
  // The provider is the frame every variant here mounts inside — it renders
  // nothing of its own, so it is demoed by being the thing that makes these work.
  covers: ["CurrenciesProvider"],
  variants: {
    default: {
      description: "A euro price shown to a viewer whose display currency is USD.",
      viewport: "phone",
      step: "converted",
      render: () => <Bag display="USD" />,
    },
    same: {
      description:
        "Same currency on both sides: there is nothing to convert, and no estimate is invented.",
      viewport: "desktop",
      step: "same-currency",
      render: () => <Bag display="EUR" />,
    },
  },
});
