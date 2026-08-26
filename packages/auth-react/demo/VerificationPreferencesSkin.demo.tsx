/**
 * When to be asked to prove it is you a second time.
 *
 * The screen this demo exists to argue about is the UNDECIDED one. Rows are
 * sparse by contract: a scope with no preference row follows whatever level
 * the endpoint declares, which the client is never told. So an undecided row
 * shows NO selection and says it follows the app's default — a switch drawn
 * in the off position would be a confident lie about a security setting, and
 * that is the exact class of defect this wave exists to remove.
 *
 * The cost of switching a scope off is printed above the controls, not raised
 * by the 403 that follows the press.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { VerificationPreferences } from "../src/default/security/VerificationPreferences.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  VERIFICATION_PREFERENCES,
  VERIFICATION_PREFERENCES_UNSET,
} from "./fixtures.js";

const DECIDED: DemoHandlers = {
  "/verification/preferences/": VERIFICATION_PREFERENCES,
};
const UNDECIDED: DemoHandlers = {
  "/verification/preferences/": VERIFICATION_PREFERENCES_UNSET,
};
const FAILED: DemoHandlers = {
  "/verification/preferences/": [
    500,
    { localizable_error: "error.500.internal" },
  ],
};

function Panel(props: {
  handlers: DemoHandlers;
  scopes?: readonly string[];
}): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <VerificationPreferences
          {...(props.scopes !== undefined ? { scopes: props.scopes } : {})}
        />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.verification-preferences-skin",
  title: "Extra verification (default skin)",
  description:
    "One decision per scope, sparse by contract. An undecided scope shows no selection and says it follows the app's default; switching one off is itself step-up protected, and the screen says so before the press.",
  component: VerificationPreferences,
  variants: {
    default: {
      description:
        "Two decisions taken: settings changes ask, a host scope has been switched off.",
      step: "decided",
      render: () => (
        <Panel
          handlers={DECIDED}
          scopes={["verification.settings", "wallet.withdraw"]}
        />
      ),
    },
    undecided: {
      description:
        "Nothing decided yet: no selection, and the row says what it is following instead.",
      step: "undecided",
      viewport: "phone",
      render: () => <Panel handlers={UNDECIDED} />,
    },
    failed: {
      description: "The read fails — stated, with a retry, not an empty list of choices.",
      step: "failed",
      render: () => <Panel handlers={FAILED} />,
    },
  },
});
