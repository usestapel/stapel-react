/**
 * The screen stapel-auth redirects a SCANNER to.
 *
 * The person reading it is holding the phone; the device asking to be signed
 * in is somewhere else, and they cannot see it. So the copy addresses that
 * asymmetry directly, both answers are equally reachable, and the screen
 * paints its own page ground — it is a full page the backend navigates to,
 * not a card dropped into someone else's layout.
 *
 * The missing-key variant is the one that used to be silent: with no `key` in
 * the address there is nothing to confirm, and the screen says so instead of
 * rendering a working-looking form that can only fail.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { QrConfirmPanel } from "../src/default/QrConfirmPanel.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

const HANDLERS: DemoHandlers = {
  "/confirm/": { status: "confirmed" },
  "/reject/": { status: "rejected" },
};

function Panel(props: { qrKey: string | null }): ReactElement {
  return (
    <AuthDemoHarness handlers={HANDLERS}>
      <QrConfirmPanel qrKey={props.qrKey} />
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.qr-confirm-skin",
  title: "Confirm a sign-in (default skin)",
  description:
    "The scanner's screen: approve or decline a sign-in on a device you are not looking at. Both answers are equally reachable, and a missing code is stated rather than rendered as a form.",
  component: QrConfirmPanel,
  variants: {
    default: {
      description: "A real code to approve or decline.",
      step: "pending",
      viewport: "phone",
      render: () => <Panel qrKey="qr_demo" />,
    },
    "no-key": {
      description:
        "The address carries no code. The screen states the problem instead of pretending to work.",
      step: "missingKey",
      render: () => <Panel qrKey={null} />,
    },
  },
});
