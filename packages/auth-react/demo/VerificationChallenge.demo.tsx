/**
 * Verification challenge (step-up) — headless bag demo. The controller is
 * driven by a 403 verification interception; `renderWhenIdle` shows the idle
 * shell so the demo has something to render without a live challenge.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { VerificationChallenge } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function VerificationDemo(): ReactElement {
  return (
    <AuthDemoHarness>
      <VerificationChallenge renderWhenIdle>
        {(bag) => (
          <DemoCard heading="VerificationChallenge">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.chooseFactor("totp")}
                labelKey="demo.action.begin"
              />
              <DemoButton run={() => bag.cancel()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </VerificationChallenge>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.verification-challenge",
  title: "Verification challenge (step-up)",
  description:
    "Headless step-up factor prompt raised by a 403 verification interception: chooseFactor(), then submitCode()/submitPasskey().",
  component: VerificationChallenge,
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <VerificationDemo /> },
  },
});
