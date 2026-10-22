/**
 * The account control a shell puts at the trailing edge of its top bar — the
 * `auth.account_menu` embed. The menu opens on its own here so its items are
 * visible: the identity line (which account this tab is in), "Account" when
 * the project routes an account section, and "Sign out", which is always
 * there.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AccountMenu } from "../src/default/AccountMenu.js";
import type { StapelUser } from "../src/api/types.js";
import { AuthDemoHarness, DemoCard } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { ME } from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/logout/": { message: "ok" } };

const USER = {
  ...ME,
  auth_type: "email",
  is_email_verified: true,
  is_phone_verified: false,
  is_staff: false,
  is_superuser: false,
  oauth_provider: null,
  created_at: "2026-01-01T00:00:00Z",
  last_login: null,
} as unknown as StapelUser;

function Menu(props: { withAccount: boolean }): ReactElement {
  return (
    <AuthDemoHarness handlers={HANDLERS} signedInAs={USER}>
      <DemoCard heading="AccountMenu">
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <AccountMenu
            defaultOpen
            {...(props.withAccount ? { onOpen: () => undefined } : {})}
          />
        </div>
      </DemoCard>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.account-menu-skin",
  title: "Account menu (default skin)",
  description:
    "The top-bar account control: who is signed in, the way to the account section, and sign-out. Renders nothing for a visitor.",
  component: AccountMenu,
  tokens: ["text", "surface", "danger"],
  variants: {
    default: {
      description: "The project routes an account section, so the menu offers it above sign-out.",
      step: "open",
      viewport: "phone",
      render: () => <Menu withAccount />,
    },
    "sign-out-only": {
      description:
        "No account section in this project: the menu offers sign-out only, never an item that goes nowhere.",
      step: "signOutOnly",
      render: () => <Menu withAccount={false} />,
    },
  },
});
