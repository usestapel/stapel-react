/**
 * Passwordless (OTP) login — the flagship demo (frontend-guardrails §4.2).
 * Shows the headless render-prop bag, token-driven chrome, and the tracked
 * pattern for a flow component: every action button steps the `auth.otp`
 * machine, which is auto-instrumented (`flow.auth.otp.<step>`), so the buttons
 * declare `data-analytics="flow"` rather than a hand-wired event (§3.2 b).
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PasswordlessLogin } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
  type DemoHandlers,
} from "./_harness.js";

const happy: DemoHandlers = {
  "/email/request/": { message: "sent", target: "a***@example.com" },
  "/email/verify/": {
    status: "LOGGED_IN",
    user: { id: "u_1", username: "ada", email: "ada@example.com" },
    tokens: { access: "acc", refresh: "ref" },
  },
};

// A locked account: the request endpoint answers 429, so the flow reaches its
// `requestError` step — the demo doubles as the error-state showcase.
const locked: DemoHandlers = {
  "/email/request/": [429, { error: { code: "auth.otp.locked" } }],
};

function OtpDemo(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <PasswordlessLogin>
        {(bag) => (
          <DemoCard heading="PasswordlessLogin">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.requestCode("email", "ada@example.com")}
                labelKey="demo.action.request"
              />
              <DemoButton
                run={() => bag.submitCode("123456")}
                labelKey="demo.action.submit"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </PasswordlessLogin>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.passwordless-login",
  title: "Passwordless login (OTP)",
  description:
    "Headless email → code → session. The render-prop bag exposes state.step plus requestCode/submitCode/reset; wire your own markup.",
  component: PasswordlessLogin,
  covers: ["AuthProvider"],
  flow: "auth.otp",
  tokens: ["card-bg", "card-border", "button-primary-bg", "text-brand"],
  variants: {
    default: {
      description: "Happy path: request a code, then verify it.",
      render: () => <OtpDemo handlers={happy} />,
    },
    locked: {
      description: "Rate-limited account — the flow reaches its error step.",
      mock: "otp-locked",
      render: () => <OtpDemo handlers={locked} />,
    },
  },
});
