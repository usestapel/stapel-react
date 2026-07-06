/** Password login (with optional TOTP step-up) — headless bag demo. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PasswordLogin } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function PasswordLoginDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={{ "/password/login/": { status: "LOGGED_IN" } }}>
      <PasswordLogin>
        {(bag) => (
          <DemoCard heading="PasswordLogin">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.login("ada", "hunter2")}
                labelKey="demo.action.login"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </PasswordLogin>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.password-login",
  title: "Password login",
  description:
    "Headless login/password sign-in; on a TOTP challenge the bag surfaces submitTotp() for the second factor.",
  component: PasswordLogin,
  flow: "auth.password_login",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <PasswordLoginDemo /> },
  },
});
