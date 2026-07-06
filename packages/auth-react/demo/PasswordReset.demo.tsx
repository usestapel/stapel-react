/** Password reset via OTP — headless bag demo. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PasswordReset } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function PasswordResetDemo(): ReactElement {
  return (
    <AuthDemoHarness
      handlers={{ "/request/": { message: "sent", target: "a***@example.com" } }}
    >
      <PasswordReset>
        {(bag) => (
          <DemoCard heading="PasswordReset">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.request("email", "ada@example.com")}
                labelKey="demo.action.request"
              />
              <DemoButton
                run={() => bag.submit("123456", "newpass1")}
                labelKey="demo.action.submit"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </PasswordReset>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.password-reset",
  title: "Password reset",
  description:
    "Headless forgot-password: request an OTP to a channel, then submit the code with the new password.",
  component: PasswordReset,
  flow: "auth.password_reset",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <PasswordResetDemo /> },
  },
});
