/**
 * THE DEFAULT SKIN, IN THE VIEWER — the role picker as it ships.
 *
 * Two things it refuses to do, both visible here: it never offers a hardcoded
 * builtin four (the menu is the EFFECTIVE registry, so a deployment's own
 * `secretary` is in it, title-cased because no bundle carries copy for it),
 * and when the registry cannot be read it renders NO picker at all — the role
 * the member actually holds, plus the reason there is nothing to choose from.
 * A picker built from a guess is worse than a stated refusal.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { RoleSelectField } from "../src/default/RoleSelectField.js";
import { WORKSPACES_I18N_KEYS } from "../src/i18n/keys.js";
import { WorkspacesDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { ROLES_DOWN_HANDLERS, ROLES_HANDLERS } from "./skinFixtures.js";

/** The field is controlled — the demo owns the value the way a roster row
 * does, so picking a role in the viewer actually moves the control. */
function FieldBody(props: { initial: string }): ReactElement {
  const t = useT();
  const [role, setRole] = useState(props.initial);
  return (
    <SkinTheme style={{ padding: spacing["5"], maxWidth: "22rem" }}>
      <RoleSelectField
        value={role}
        onChange={setRole}
        showLabel
        label={t(WORKSPACES_I18N_KEYS.membersRolePickerLabel, {
          member: "Grace Hopper",
        })}
        testId="demo-role-field"
      />
    </SkinTheme>
  );
}

function Field(props: { handlers: DemoHandlers; initial: string }): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={props.handlers}>
      <FieldBody initial={props.initial} />
    </WorkspacesDemoHarness>
  );
}

export default defineDemo({
  id: "workspaces.role-select-field",
  title: "Role picker (default skin)",
  description:
    "The shipped role field: an accessible name of its own (a roster renders one per row, and 'combobox, combobox, combobox' is what a screen reader says otherwise), the effective registry as options with each role's rank as the caption, and a stated refusal instead of a picker when the registry cannot be read.",
  component: RoleSelectField,
  // The field renders the headless `RoleSelect` and nothing else.
  covers: ["RoleSelect"],
  variants: {
    default: {
      description:
        "The builtin four plus a deployment's own `secretary`, which has no translation and is title-cased rather than printed as a slug.",
      step: "ready",
      render: () => <Field handlers={ROLES_HANDLERS} initial="admin" />,
    },
    "no-registry": {
      description:
        "GET /roles is down. The role the member holds is still shown; there is no menu, and the reason says why.",
      step: "failed",
      viewport: "phone",
      render: () => <Field handlers={ROLES_DOWN_HANDLERS} initial="admin" />,
    },
  },
});
