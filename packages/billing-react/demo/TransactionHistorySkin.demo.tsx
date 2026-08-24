/**
 * The credit ledger — the endpoint that had a client, a query key, a hook,
 * and zero consumers anywhere in the repo.
 *
 * "Where did my credits go" is the question a wallet cannot answer on its
 * own, and since stapel-billing 0.11.0 it has three new answers the balance
 * hides: a hold captured, a debt collected off the top of a purchase, a lot
 * that expired. Each row therefore names the kind of movement in words (never
 * `transcription_charge`), signs the delta so the direction is visible, dates
 * it through `Intl`, and states where the balance landed.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TransactionHistory } from "../src/default/TransactionHistory.js";
import { BillingDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { LEDGER_EMPTY_HANDLERS, LEDGER_HANDLERS } from "./fixtures.js";

function Ledger(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <BillingDemoHarness handlers={props.handlers}>
      <TransactionHistory />
    </BillingDemoHarness>
  );
}

export default defineDemo({
  id: "billing.transaction-history",
  title: "Credit history (default skin)",
  description:
    "The credit ledger, paged forward by the server's own cursors: a purchase, two charges, the plan's monthly grant and credits that died of old age — each with a signed delta and the balance it left behind.",
  component: TransactionHistory,
  variants: {
    default: {
      description:
        "A first page of four movements with 'Show older' offering the server's next cursor.",
      step: "ready",
      viewport: "phone",
      render: () => <Ledger handlers={LEDGER_HANDLERS} />,
    },
    empty: {
      description:
        "An answered ledger with nothing in it — the empty state, reachable only from a read that succeeded.",
      step: "empty",
      render: () => <Ledger handlers={LEDGER_EMPTY_HANDLERS} />,
    },
  },
});
