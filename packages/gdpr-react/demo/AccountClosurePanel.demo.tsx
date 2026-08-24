/**
 * The highest-stakes screen in the product, in the three states an account can
 * actually be in — including the one the visual pass caught missing its only
 * recovery action.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AccountClosurePanel } from "../src/default/AccountClosurePanel.js";
import { GdprDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CLOSURE_DELETING,
  CLOSURE_IN_GRACE,
  NO_ACTIVE_CLOSURE,
} from "./_fixtures.js";

/** The 404 that means "you are fine", folded to a null answer by the hook. */
const NOT_CLOSING: DemoHandlers = {
  "/user/account/close/status": NO_ACTIVE_CLOSURE,
};

/** Grace: a DATE, and the way back — "Keep my account" is the loud control. */
const IN_GRACE: DemoHandlers = {
  "/user/account/close/status": CLOSURE_IN_GRACE,
};

/** Grace is over: the module stops accepting a cancel, so the panel stops
 * offering one. A button that answered 409 would be worse than none. */
const ERASING: DemoHandlers = {
  "/user/account/close/status": CLOSURE_DELETING,
};

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <GdprDemoHarness handlers={props.handlers}>
      <AccountClosurePanel />
    </GdprDemoHarness>
  );
}

export default defineDemo({
  id: "gdpr.account-closure",
  title: "Delete your account",
  description:
    "Three states, three different screens. `ready(null)` is not an empty state — the read answers 404 for the account that is fine, and the hook folds it, so the panel either offers deletion or reports one. In grace the panel shows the DATE the sweep task will act on (never a countdown) and the cancel beside it; once the erasure is running the cancel is gone, because the module has stopped accepting one.",
  component: AccountClosurePanel,
  tokens: ["surface-raised", "error", "warning"],
  variants: {
    default: {
      description: "Nothing is being deleted — explain the consequence, then offer the door.",
      viewport: "phone",
      step: "idle",
      render: () => <Panel handlers={NOT_CLOSING} />,
    },
    grace: {
      description:
        "A closure that can still be called off: the date, and 'Keep my account'.",
      viewport: "phone",
      step: "grace",
      render: () => <Panel handlers={IN_GRACE} />,
    },
    erasing: {
      description: "Grace is over — the erasure is running and no cancel is offered.",
      viewport: "phone",
      step: "deleting",
      render: () => <Panel handlers={ERASING} />,
    },
  },
});
