/**
 * Who has elevated access, from the operator's side.
 *
 * The contract identifies accounts by UUID and nothing else, and this pair
 * has no user directory to resolve them against — so the rows print the id,
 * labelled as an account id, rather than a name invented beside a permission
 * grant. `assigned_by: null` means the system granted it (a fixture, a
 * management command), which is a different fact from "we do not know", and
 * the row says which.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { StaffRolesPanel } from "../src/default/admin/StaffRolesPanel.js";
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
      <StaffRolesPanel />
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.admin-staff-roles-skin",
  title: "Staff roles (operator console)",
  description:
    "Every elevated grant on the deployment and its provenance. Accounts are named by the id the contract carries — a resolved display name here would be a guess printed beside a permission.",
  component: StaffRolesPanel,
  variants: {
    default: {
      description:
        "A moderator granted by a colleague, and a support role the system assigned.",
      step: "ready",
      render: () => <Screen handlers={ADMIN_HANDLERS} />,
    },
    empty: {
      description: "Nobody holds a staff role yet.",
      step: "empty",
      viewport: "phone",
      render: () => <Screen handlers={ADMIN_HANDLERS_EMPTY} />,
    },
    forbidden: {
      description:
        "The read is refused. An empty roles list would read as 'nobody has access', which is the opposite of what happened.",
      step: "forbidden",
      render: () => <Screen handlers={ADMIN_HANDLERS_FORBIDDEN} />,
    },
  },
});
