/** Password change (with-password or OTP-verified) — headless bag demo. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PasswordChange } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function PasswordChangeDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={{ "/password/change/": { status: "ok" } }}>
      <PasswordChange>
        {(bag) => (
          <DemoCard heading="PasswordChange">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.changeWithPassword("hunter2", "newpass1")}
                labelKey="demo.action.submit"
              />
              <DemoButton
                run={() => bag.requestOtp("email")}
                labelKey="demo.action.request"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </PasswordChange>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.password-change",
  title: "Password change",
  description:
    "Headless change-password for a signed-in user: directly with the old password, or OTP-verified when no password is set.",
  component: PasswordChange,
  flow: "auth.password_change",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <PasswordChangeDemo /> },
  },
});
