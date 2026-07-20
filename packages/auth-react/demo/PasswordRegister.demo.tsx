/** Password registration (SET-password) — headless bag demo. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PasswordRegister } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function PasswordRegisterDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={{ "/password/register/": { status: "REGISTERED" } }}>
      <PasswordRegister>
        {(bag) => (
          <DemoCard heading="PasswordRegister">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() =>
                  bag.register({ email: "ada@example.dev", password: "hunter2" })
                }
                labelKey="demo.action.create"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </PasswordRegister>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.password-register",
  title: "Password registration",
  description:
    "Headless set-password registration — the SET-password counterpart to PasswordLogin. Adopts the resulting session on success: creates a new account, promotes an anonymous session, or just makes an anonymous session portable (adopt()'s user.is_anonymous branch decides).",
  component: PasswordRegister,
  flow: "auth.password_register",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <PasswordRegisterDemo /> },
  },
});
