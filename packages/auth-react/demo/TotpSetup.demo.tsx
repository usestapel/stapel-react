/** TOTP authenticator setup — headless bag demo. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TotpSetup } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function TotpSetupDemo(): ReactElement {
  return (
    <AuthDemoHarness
      handlers={{
        "/totp/setup/": { secret: "JBSWY3DPEHPK3PXP", otpauth_url: "otpauth://totp/demo" },
      }}
    >
      <TotpSetup>
        {(bag) => (
          <DemoCard heading="TotpSetup">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton run={() => bag.start()} labelKey="demo.action.start" />
              <DemoButton
                run={() => bag.confirm("123456")}
                labelKey="demo.action.submit"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </TotpSetup>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.totp-setup",
  title: "TOTP setup",
  description:
    "Headless authenticator enrolment: start() returns the secret/otpauth URL to render as a QR; confirm() verifies the first code.",
  component: TotpSetup,
  flow: "auth.totp_setup",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <TotpSetupDemo /> },
  },
});
