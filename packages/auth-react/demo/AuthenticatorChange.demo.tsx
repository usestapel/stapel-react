/** Instant authenticator (email/phone) change — headless bag demo. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AuthenticatorChange } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function AuthenticatorChangeDemo(): ReactElement {
  return (
    <AuthDemoHarness
      handlers={{ "/request-old/": { message: "sent", target: "a***@example.com" } }}
    >
      <AuthenticatorChange>
        {(bag) => (
          <DemoCard heading="AuthenticatorChange">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.startInstant("email")}
                labelKey="demo.action.start"
              />
              <DemoButton
                run={() => bag.submitOldCode("123456")}
                labelKey="demo.action.submit"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </AuthenticatorChange>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.authenticator-change",
  title: "Authenticator change (instant)",
  description:
    "Headless instant email/phone change: verify the old channel, then confirm the new one — a four-step OTP ladder.",
  component: AuthenticatorChange,
  flow: "auth.authenticator_change",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <AuthenticatorChangeDemo /> },
  },
});
