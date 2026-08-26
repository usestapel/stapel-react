/**
 * The whole security page, composed — the one component a host mounts behind
 * a single menu item.
 *
 * This is the shot that shows the sections as sections: contact details,
 * password, two-factor, devices, connected accounts, extra verification, the
 * log. Each widget paints its own card and the PAGE paints the ground, which
 * is what keeps the whole thing on the project's palette in both themes
 * instead of inheriting whatever the host happens to be.
 *
 * The empty-account variant is the honest first-run: every section present,
 * each saying what it is for and offering the one way to start.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SecuritySettings } from "../src/default/SecuritySettings.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { SECURITY_HANDLERS, SECURITY_HANDLERS_BARE } from "./fixtures.js";

function Page(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <SecuritySettings />
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.security-settings-skin",
  title: "Security settings page (default skin)",
  description:
    "The composed page a host mounts behind one menu item: contact details, password, two-factor, devices, connected accounts, extra verification and the security log — as sections, on a page that paints its own ground.",
  component: SecuritySettings,
  variants: {
    default: {
      description:
        "A well-protected account: two-factor on, two passkeys, three sessions, one connected provider.",
      step: "ready",
      render: () => <Page handlers={SECURITY_HANDLERS} />,
    },
    "fresh-account": {
      description:
        "Nothing set up yet. Every section is present and says what it is for — this is the page most people see first.",
      step: "empty",
      viewport: "phone",
      render: () => <Page handlers={SECURITY_HANDLERS_BARE} />,
    },
  },
});
