/**
 * Passkey registration — the authenticated counterpart to passkey login
 * (auth-sa.md §17). begin() fetches creation options; the host runs
 * `navigator.credentials.create` and calls submitCredential().
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PasskeyRegistration } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
  type DemoHandlers,
} from "./_harness.js";

const handlers: DemoHandlers = {
  "/passkey/register/begin/": {
    options: { challenge: "reg", rp: { id: "stapel.dev", name: "Stapel" } },
  },
};

function PasskeyRegistrationDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={handlers}>
      <PasskeyRegistration>
        {(bag) => (
          <DemoCard heading="PasskeyRegistration">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.begin("Ada's laptop")}
                labelKey="demo.action.begin"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </PasskeyRegistration>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.passkey-registration",
  title: "Passkey registration",
  description:
    "Headless passkey enrolment for a signed-in user: begin() fetches creation options; submitCredential() finishes the ceremony result.",
  component: PasskeyRegistration,
  flow: "auth.passkey_registration",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: {
      description: "Begin enrolment; parks at awaitingCredential (no binding).",
      render: () => <PasskeyRegistrationDemo />,
    },
  },
});
