/**
 * Passkey (WebAuthn) login — pilot demo. The headless component is THIN: it
 * drives the begin → assertion → session steps and leaves the
 * `navigator.credentials.get` ceremony to the host binding (auth-sa.md §17).
 * The demo omits the binding, so it parks at `awaitingAssertion` — enough to
 * show the bag contract and token chrome.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PasskeyLogin } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
  type DemoHandlers,
} from "./_harness.js";

const handlers: DemoHandlers = {
  "/passkey/authenticate/begin/": {
    session_key: "sess_1",
    options: { challenge: "abc", rpId: "stapel.dev" },
  },
};

function PasskeyLoginDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={handlers}>
      <PasskeyLogin>
        {(bag) => (
          <DemoCard heading="PasskeyLogin">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.begin("ada@example.com")}
                labelKey="demo.action.begin"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </PasskeyLogin>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.passkey-login",
  title: "Passkey login (WebAuthn)",
  description:
    "Headless passkey sign-in: begin() fetches assertion options; the host performs the credential ceremony and calls submitAssertion().",
  component: PasskeyLogin,
  flow: "auth.passkey_login",
  tokens: ["card-bg", "button-primary-bg", "text-brand"],
  variants: {
    default: {
      description: "Begin an assertion; parks at awaitingAssertion (no binding).",
      render: () => <PasskeyLoginDemo />,
    },
  },
});
