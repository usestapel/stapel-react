/**
 * The devices screen, as it ships.
 *
 * Three rows on purpose, because the three are different questions: the
 * device you are reading this on (no actions — you cannot sign yourself out
 * of the session doing the signing), a phone you recognize, and a sign-in
 * from a machine nobody recognizes, which is the row the whole screen exists
 * for. The row geometry is a container query on the ROW's own width, so every
 * action lands in the same place at a given card width instead of tipping row
 * by row.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SessionsList } from "../src/default/security/SessionsList.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { SECURITY_HANDLERS, SECURITY_HANDLERS_BARE } from "./fixtures.js";

const FAILED: DemoHandlers = {
  "/sessions/": [500, { localizable_error: "error.500.internal" }],
};

function Panel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <SessionsList />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.sessions-list-skin",
  title: "Devices and sessions (default skin)",
  description:
    "Every session on the account: what it is, where from, how long ago, and which one is this device. The unrecognized sign-in carries its own badge and a 'that was me' beside the sign-out, because confirming and revoking are different decisions.",
  component: SessionsList,
  variants: {
    default: {
      description:
        "This device, a recognized phone, and one unrecognized sign-in from another country.",
      step: "ready",
      render: () => <Panel handlers={SECURITY_HANDLERS} />,
    },
    "single-device": {
      description:
        "Only this device — there is nothing to sign out, so the bulk action is not offered.",
      step: "single",
      viewport: "phone",
      render: () => <Panel handlers={SECURITY_HANDLERS_BARE} />,
    },
    failed: {
      description:
        "The read fails. The card states the refusal and offers a retry; it never renders as 'no other devices'.",
      step: "failed",
      render: () => <Panel handlers={FAILED} />,
    },
  },
});
