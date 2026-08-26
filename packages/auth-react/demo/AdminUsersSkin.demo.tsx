/**
 * Provisioning an account directly.
 *
 * Two of the controls on this form change what happens to somebody else — one
 * sends a real message to a real address, the other decides whether contact
 * details are trusted without the person ever proving them. Neither is a
 * preference, so each carries its consequence beside it rather than a bare
 * label.
 *
 * The screen ends on the created account, not on a toast: the id is what an
 * operator pastes into the staff-roles screen next, so it is selectable and
 * it stays on screen.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AdminUsersPanel } from "../src/default/admin/AdminUsersPanel.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

const OK: DemoHandlers = {
  "/admin-users/": {
    user_id: "9c8b7a65-4321-4fed-8cba-0987654321fe",
    email: "grace@example.com",
    phone: null,
    username: "grace",
  },
};

const TAKEN: DemoHandlers = {
  "/admin-users/": [400, { localizable_error: "error.400.email_taken" }],
};

function Screen(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AuthDemoHarness handlers={props.handlers}>
      <AdminUsersPanel />
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.admin-users-skin",
  title: "Create an account (operator console)",
  description:
    "Provision an account with no sign-up and no code. The two switches that affect somebody else state their consequence beside them, and the result is the created account's id, kept on screen because it is what gets used next.",
  component: AdminUsersPanel,
  variants: {
    default: {
      description: "The form as it opens, with the contract's own defaults.",
      step: "form",
      viewport: "phone",
      render: () => <Screen handlers={OK} />,
    },
    refused: {
      description:
        "The address is already on an account. The backend's own sentence, translated, beside the form that produced it.",
      step: "error",
      render: () => <Screen handlers={TAKEN} />,
    },
  },
});
