/**
 * The screen an account meets BEFORE it is really signed in: the organization
 * requires a new password on first login.
 *
 * It is a gate, so it is a full card on a painted page with exactly one
 * primary action and no way around itself. The mismatch state is the one this
 * screen has to get right — two boxes that disagree is the most common thing
 * that happens here, and it is answered beside the fields rather than by a
 * request that comes back refused.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ForcedPasswordChangeCard } from "../src/default/FirstLoginPanels.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { ME } from "./fixtures.js";

const OK: DemoHandlers = {
  "/password/forced-change/": {
    status: "LOGGED_IN",
    user: ME,
    tokens: { access: "acc_demo", refresh: "ref_demo" },
  },
};

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <div style={{ maxWidth: "26rem", margin: "0 auto" }}>
        <ForcedPasswordChangeCard challengeToken="demo-challenge" />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.forced-password-change-skin",
  title: "Forced password change (default skin)",
  description:
    "The first-login gate: a new password and its confirmation, one primary action, and no route around it. On an account that also owes a second factor, finishing here chains straight into enrollment.",
  component: ForcedPasswordChangeCard,
  covers: ["ForcedPasswordChange"],
  variants: {
    // A policy refusal here arrives only AFTER a submit, so no static render
    // can photograph it: the variant that claimed to was byte-identical to
    // this one (visual pass C4). The refusals this package CAN seed are the
    // ones a mount reads — see the panels with a query behind them.
    default: {
      description: "The gate as it opens.",
      step: "idle",
      viewport: "phone",
      render: () => <Panel handlers={OK} />,
    },
  },
});
