/** Magic-link request — headless bag demo. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MagicLink } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function MagicLinkDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={{ "/magic/": { status: "sent" } }}>
      <MagicLink>
        {(bag) => (
          <DemoCard heading="MagicLink">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.request("ada@example.com", "/app")}
                labelKey="demo.action.request"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </MagicLink>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.magic-link",
  title: "Magic link",
  description:
    "Headless magic-link request: request(email, redirectUrl) sends a one-tap sign-in link; the redirect is open-redirect-guarded.",
  component: MagicLink,
  flow: "auth.magic_link",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <MagicLinkDemo /> },
  },
});
