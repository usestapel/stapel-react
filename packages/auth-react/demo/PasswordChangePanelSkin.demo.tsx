/**
 * Changing a password, as it ships.
 *
 * The panel is a tab per method the BACKEND says this account can actually
 * use — the current password, a code to the verified email, a code to the
 * verified phone — so it never offers a route that will refuse. An account
 * with none of them gets a stated empty state with a way forward, not a form
 * that cannot submit.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PasswordChangePanel } from "../src/default/security/PasswordChangePanel.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CAPABILITIES,
  ME,
  PASSWORD_METHODS,
  PASSWORD_METHODS_NONE,
} from "./fixtures.js";

const METHODS: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/me/": ME,
  "/password/methods/": PASSWORD_METHODS,
};

const NO_METHODS: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/me/": ME,
  "/password/methods/": PASSWORD_METHODS_NONE,
};

const FAILED: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/me/": ME,
  "/password/methods/": [503, { localizable_error: "error.503.mandate_unavailable" }],
};

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <PasswordChangePanel />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.password-change-skin",
  title: "Change password (default skin)",
  description:
    "One tab per route the backend says this account can actually take: the current password, or a code to a verified contact. Never a form that is going to be refused.",
  component: PasswordChangePanel,
  covers: ["PasswordChange"],
  variants: {
    default: {
      description: "Current password or an emailed code.",
      step: "methods",
      viewport: "phone",
      render: () => <Panel handlers={METHODS} />,
    },
    "no-methods": {
      description:
        "No route exists yet — said plainly, with what would create one, instead of an unusable form.",
      step: "empty",
      render: () => <Panel handlers={NO_METHODS} />,
    },
    failed: {
      description: "The methods read fails: the refusal is stated, with a retry.",
      step: "failed",
      render: () => <Panel handlers={FAILED} />,
    },
  },
});
