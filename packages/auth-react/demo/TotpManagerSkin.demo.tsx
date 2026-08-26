/**
 * Two-factor authentication, as it ships.
 *
 * The card answers one question before anything else — is it on — and then
 * offers only the actions that state allows: set up when it is off, replace
 * and switch off when it is on. The backup-code count is a badge that changes
 * colour when it runs low, because "8 codes left" and "1 code left" are not
 * the same fact and a person should not have to open a dialog to learn which
 * one they are living in.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TotpManager } from "../src/default/security/TotpManager.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CAPABILITIES,
  NO_DELAYED_CHANGE,
  PENDING_DELAYED_CHANGE,
  SECURITY_STATUS_BARE,
  SECURITY_STATUS_STRONG,
} from "./fixtures.js";

const ENABLED: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/security/status/": SECURITY_STATUS_STRONG,
  "/totp/change/delayed/status/": NO_DELAYED_CHANGE,
};

const OFF: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/security/status/": SECURITY_STATUS_BARE,
  "/totp/change/delayed/status/": NO_DELAYED_CHANGE,
};

const PENDING: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/security/status/": SECURITY_STATUS_STRONG,
  "/totp/change/delayed/status/": PENDING_DELAYED_CHANGE,
};

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <TotpManager />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.totp-manager-skin",
  title: "Two-factor authentication (default skin)",
  description:
    "The authenticator-app card: on or off stated first, the backup codes left, and only the actions that state allows. A scheduled removal replaces the whole body — while one is in flight there is nothing else to decide here except whether to call it off.",
  component: TotpManager,
  variants: {
    enabled: {
      description: "Two-factor is on with 8 backup codes: replace or switch off.",
      step: "enabled",
      render: () => <Panel handlers={ENABLED} />,
    },
    off: {
      description: "Never set up — one primary action, and nothing else pretending to be one.",
      step: "disabled",
      viewport: "phone",
      render: () => <Panel handlers={OFF} />,
    },
    "removal-scheduled": {
      description:
        "A 'lost my authenticator' removal is 6 days into its cooldown. The banner says when it lands and offers the one way to stop it.",
      step: "pendingDelayed",
      render: () => <Panel handlers={PENDING} />,
    },
  },
});
