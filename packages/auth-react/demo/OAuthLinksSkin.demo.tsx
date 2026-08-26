/**
 * Connected accounts, as it ships.
 *
 * Two facts this screen has to keep straight. First, "Connect" needs a
 * host-supplied token getter (the provider's own SDK/popup) — without one the
 * control is BLOCKED with the reason printed beside it, never a tooltip on a
 * disabled button that no touch or keyboard user can reach. Second,
 * disconnecting a provider may be the way somebody signs in, so it goes
 * through a danger confirm that names the provider.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { OAuthLinks } from "../src/default/security/OAuthLinks.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { CAPABILITIES, CAPABILITIES_BARE, OAUTH_LINKS } from "./fixtures.js";

const LINKED: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/oauth/links/": OAUTH_LINKS,
};

const NONE_LINKED: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  "/oauth/links/": { links: [] },
};

const NO_PROVIDERS: DemoHandlers = {
  "/capabilities/": CAPABILITIES_BARE,
  "/oauth/links/": { links: [] },
};

/** The host's provider SDK. In a viewer there is none to run, so the demo
 *  supplies one only where the point is that Connect is available. */
function getAccessToken(): Promise<string> {
  return Promise.resolve("demo-provider-token");
}

function Panel(props: {
  handlers: DemoHandlers;
  withGetter: boolean;
}): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <OAuthLinks {...(props.withGetter ? { getAccessToken } : {})} />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.oauth-links-skin",
  title: "Connected accounts (default skin)",
  description:
    "Providers this deployment offers, which of them this account is connected to, and the two controls that exist. Connect states its own blocker in text when the host has wired no provider SDK.",
  component: OAuthLinks,
  variants: {
    default: {
      description: "Google connected, GitHub available — both controls live.",
      step: "linked",
      render: () => <Panel handlers={LINKED} withGetter />,
    },
    "connect-blocked": {
      description:
        "No provider SDK is wired, so Connect is off and says why, right beside itself.",
      step: "blocked",
      viewport: "phone",
      render: () => <Panel handlers={NONE_LINKED} withGetter={false} />,
    },
    "no-providers": {
      description:
        "This deployment configured no providers: an empty state with a reason, not a blank card.",
      step: "empty",
      render: () => <Panel handlers={NO_PROVIDERS} withGetter />,
    },
  },
});
