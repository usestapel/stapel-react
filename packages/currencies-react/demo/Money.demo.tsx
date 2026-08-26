/**
 * The headless half: `<Money>` hands a bag to a render prop and draws nothing
 * itself. This is the layer a host with its own design system REPLACES — the
 * demo shows that the arithmetic and the locale rules survive the replacement.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { cssVar, spacing } from "@stapel/tokens";
import { Money } from "../src/index.js";
import {
  CurrenciesDemoHarness,
  DemoCard,
  HANDLERS_READY,
  StepBadge,
} from "./_harness.js";

/** A labelled row, so the bag's fields read as facts rather than as a dump. */
function Row(props: { label: string; children: ReactElement | string }): ReactElement {
  const t = useT();
  return (
    <div style={{ display: "flex", gap: spacing["2"], alignItems: "baseline" }}>
      <span style={{ color: cssVar("text-muted") }}>{t(props.label)}</span>
      <span>{props.children}</span>
    </div>
  );
}

/** An absent estimate is a sentence, not a bare em dash: the two are
 * indistinguishable exactly when the render is what is on trial. */
function Estimate(props: { converted: string | undefined }): ReactElement {
  const t = useT();
  return (
    <Row label="demo.label.estimate">
      {props.converted ?? t("demo.label.noEstimate")}
    </Row>
  );
}

function Bag(props: { display: string }): ReactElement {
  return (
    <CurrenciesDemoHarness handlers={HANDLERS_READY}>
      <DemoCard heading="Money">
        <Money amount="1500.00" currency="EUR" displayCurrency={props.display}>
          {(bag) => (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing["2"] }}>
              <Row label="demo.label.price">{bag.original}</Row>
              <Estimate converted={bag.converted} />
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
