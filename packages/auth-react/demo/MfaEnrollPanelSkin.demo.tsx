/**
 * The other first-login gate: the organization requires a second factor
 * before this session becomes a real one.
 *
 * A factor PICKER, not a form: an authenticator app and a passkey are
 * genuinely different journeys, and which one a person can complete depends
 * on the device in their hand. Restricting the offer to one method is a
 * deployment's decision, so it is a prop — and the picker collapses honestly
 * rather than showing a choice of one.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MfaEnrollPanel } from "../src/default/FirstLoginPanels.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { ME } from "./fixtures.js";

const HANDLERS: DemoHandlers = {
  "/mfa/enroll/exchange/": {
    status: "MFA_ENROLL_SESSION",
    access: "enroll-access",
    expires_in: 3600,
  },
  "/me/": ME,
};

function Panel(props: { methods?: readonly ("totp" | "passkey")[] }): ReactElement {
  return (
    <AuthDemoHarness handlers={HANDLERS}>
      <div style={{ maxWidth: "26rem", margin: "0 auto" }}>
        <MfaEnrollPanel
          challengeToken="demo-challenge"
          {...(props.methods !== undefined ? { methods: props.methods } : {})}
        />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.mfa-enroll-skin",
  title: "Enroll a second factor (default skin)",
  description:
    "The first-login MFA gate: pick an authenticator app or a passkey and finish the enrollment inside an enroll-scoped session. Completing a factor is what turns that session into a full one.",
  component: MfaEnrollPanel,
  variants: {
    default: {
      description: "Both factors offered — the picker before a choice is made.",
      step: "choosing",
      viewport: "phone",
      render: () => <Panel />,
    },
    "totp-only": {
      description:
        "A deployment that only allows an authenticator app: one journey, stated as the route rather than dressed up as a choice.",
      step: "totp",
      render: () => <Panel methods={["totp"]} />,
    },
  },
});
