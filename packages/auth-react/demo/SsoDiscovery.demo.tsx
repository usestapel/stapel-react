/** Enterprise SSO domain discovery — headless bag demo. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SsoDiscovery } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

function SsoDemo(): ReactElement {
  return (
    <AuthDemoHarness
      handlers={{ "/sso/lookup/": { org_slug: "acme", sso_required: true } }}
    >
      <SsoDiscovery>
        {(bag) => (
          <DemoCard heading="SsoDiscovery">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.lookup("acme.com")}
                labelKey="demo.action.lookup"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </SsoDiscovery>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.sso-discovery",
  title: "SSO discovery",
  description:
    "Headless enterprise SSO: lookup(domain) resolves whether a work email must use SSO; beginLogin(orgSlug) redirects to the IdP.",
  component: SsoDiscovery,
  flow: "auth.sso",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    default: { render: () => <SsoDemo /> },
  },
});
