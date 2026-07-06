/** Anonymous session — headless bag demo. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AnonymousSession } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function AnonymousDemo(): ReactElement {
  return (
    <AuthDemoHarness
      handlers={{
        "/anonymous/": {
          status: "LOGGED_IN",
          user: { id: "anon_1", is_anonymous: true },
          tokens: { access: "acc", refresh: "ref" },
        },
      }}
    >
      <AnonymousSession>
        {(bag) => (
          <DemoCard heading="AnonymousSession">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.create("device-123")}
                labelKey="demo.action.create"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </AnonymousSession>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.anonymous-session",
  title: "Anonymous session",
  description:
    "Headless guest session: create(deviceId) mints an anonymous user you can later upgrade to a full account.",
  component: AnonymousSession,
  flow: "auth.anonymous",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <AnonymousDemo /> },
  },
});
