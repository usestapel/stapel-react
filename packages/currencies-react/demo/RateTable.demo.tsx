/**
 * The catalogue as a table — the surface a host mounts on a settings screen.
 *
 * The note underneath is load-bearing: the contract serves no update time, so
 * the table says these are the latest stored values rather than letting a grid
 * of numbers imply a live quote.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RateTable } from "../src/default/RateTable.js";
import { useCurrencies } from "../src/index.js";
import {
  CurrenciesDemoHarness,
  DemoCard,
  HANDLERS_EMPTY,
  HANDLERS_FAILED,
  HANDLERS_READY,
} from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

function Rates(): ReactElement {
  const { state, refetch } = useCurrencies();
  return <RateTable rates={state} base="USD" onRetry={refetch} />;
}

function Framed(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <CurrenciesDemoHarness handlers={props.handlers}>
      <DemoCard heading="RateTable">
        <Rates />
      </DemoCard>
    </CurrenciesDemoHarness>
  );
}

export default defineDemo({
  id: "currencies.rate-table",
  title: "Rate table (default skin)",
  description:
    "Code, translated name, rate against the base and symbol, with the honest note about what the catalogue does and does not know.",
  component: RateTable,
  variants: {
    default: {
      description: "The seeded catalogue at 390px — the table scrolls, the page does not.",
      viewport: "phone",
      step: "ready",
      render: () => <Framed handlers={HANDLERS_READY} />,
    },
    empty: {
      description: "No currencies configured: the shared empty state, not an empty grid.",
      viewport: "desktop",
      step: "empty",
      render: () => <Framed handlers={HANDLERS_EMPTY} />,
    },
    failed: {
      description: "The read failed: the shared error surface with its retry.",
      viewport: "desktop",
      step: "failed",
      render: () => <Framed handlers={HANDLERS_FAILED} />,
    },
  },
});
