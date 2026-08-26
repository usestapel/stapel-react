/**
 * Machine credentials, from the operator's side.
 *
 * The screen is built around one fact: the secret exists exactly once, in the
 * create response. Issuing a key therefore does not close into the list — it
 * hands the value over in a dialog that says this is the only time it is
 * shown, and closing that dialog is the acknowledgement.
 *
 * The second fact it keeps straight is that switching a key off and deleting
 * it are different: one is reversible and one breaks every caller instantly.
 * Both are offered, the reversible one first, and the delete confirm says
 * which is which instead of asking "are you sure?".
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ServiceKeysPanel } from "../src/default/admin/ServiceKeysPanel.js";
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
      <ServiceKeysPanel />
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.admin-service-keys-skin",
  title: "Service keys (operator console)",
  description:
    "Credentials for machines: what each is for, whether it is live, what it may reach, and when it was last actually used. 'Never used' is printed, because that is how an operator spots a key issued for something that never shipped.",
  component: ServiceKeysPanel,
  variants: {
    default: {
      description:
        "A live key scoped to two endpoints, and a switched-off one that has never been used.",
      step: "ready",
      render: () => <Screen handlers={ADMIN_HANDLERS} />,
    },
    empty: {
      description: "No keys yet, with the reason to issue the first one.",
      step: "empty",
      viewport: "phone",
      render: () => <Screen handlers={ADMIN_HANDLERS_EMPTY} />,
    },
    forbidden: {
      description: "The read is refused, and the screen says so rather than showing no keys.",
      step: "forbidden",
      render: () => <Screen handlers={ADMIN_HANDLERS_FORBIDDEN} />,
    },
  },
});
