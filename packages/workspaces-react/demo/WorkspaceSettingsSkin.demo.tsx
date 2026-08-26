/**
 * THE DEFAULT SKIN, IN THE VIEWER — workspace settings as they ship.
 *
 * The two variants are the two verdicts the SERVER can give about the same
 * owner: one where Delete is offered, and one where an owner is refused
 * (`can_delete: false` on the instance's default workspace) and the control
 * is switched off with the server's own error code rendered as a sentence
 * beside it. The refused variant also carries the security block — the
 * `require_mfa` policy with the number of unverified members an admin has to
 * get to zero.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { WorkspaceSettings } from "../src/default/WorkspaceSettings.js";
import { WorkspacesDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_WS,
  SETTINGS_HANDLERS,
  SETTINGS_LOCKED_HANDLERS,
} from "./skinFixtures.js";

function Settings(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={props.handlers}>
      <WorkspaceSettings workspaceId={DEMO_WS} />
    </WorkspacesDemoHarness>
  );
}

export default defineDemo({
  id: "workspaces.workspace-settings",
  title: "Workspace settings (default skin)",
  description:
    "The shipped settings screen: the name and slug, the two-factor policy with the live enforcement counts (checked / missing / unverified — the last is the number to get to zero), the first-login demands for provisioned accounts, and a danger zone whose Delete is drawn from the server's own verdict.",
  component: WorkspaceSettings,
  variants: {
    default: {
      description: "An owner who may delete, and a workspace with no MFA policy on.",
      step: "ready",
      render: () => <Settings handlers={SETTINGS_HANDLERS} />,
    },
    "delete-refused": {
      description:
        "The same owner, refused: this is the instance's default workspace. Delete is off and the server's refusal is the sentence beside it; the security card shows the enforcement sweep mid-flight.",
      step: "delete-blocked",
      viewport: "phone",
      render: () => <Settings handlers={SETTINGS_LOCKED_HANDLERS} />,
    },
  },
});
