/**
 * Enterprise SSO, from the operator's side.
 *
 * The identity-provider dialog is the interesting one, and it is interesting
 * because of an absence: the contract has PUT and PATCH on an org's config
 * and NO GET. So the form cannot show what is currently configured, and it
 * says exactly that above the fields rather than rendering empty boxes that
 * look like the current state. Saving states the whole connection.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SsoOrgsPanel } from "../src/default/admin/SsoOrgsPanel.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  ADMIN_HANDLERS,
  ADMIN_HANDLERS_EMPTY,
  ADMIN_HANDLERS_FORBIDDEN,
} from "./fixtures.js";

function Screen(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <SsoOrgsPanel />
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.admin-sso-orgs-skin",
  title: "Enterprise SSO (operator console)",
  description:
    "Organizations whose people sign in through their own identity provider: the domain each claims, whether SSO is required on it, and the four operator actions. Removing one takes every account on that domain off its SSO route, so it confirms by name.",
  component: SsoOrgsPanel,
  variants: {
    default: {
      description: "Two organizations — one enforcing SSO, one where it is optional.",
      step: "ready",
      render: () => <Screen handlers={ADMIN_HANDLERS} />,
    },
    empty: {
      description: "No organizations yet, with the one action that creates the first.",
      step: "empty",
      viewport: "phone",
      render: () => <Screen handlers={ADMIN_HANDLERS_EMPTY} />,
    },
    forbidden: {
      description:
        "The caller holds no staff role. The screen states the refusal — a staff surface must never render a 403 as an empty list.",
      step: "forbidden",
      render: () => <Screen handlers={ADMIN_HANDLERS_FORBIDDEN} />,
    },
  },
});
