/** RoleSelect — the effective role registry (GET /roles), not a hardcoded four. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { RoleSelect } from "../src/index.js";
import { WorkspacesDemoHarness, DemoCard } from "./_harness.js";

/** The canned registry: the builtin four plus a deployment overlay role
 * (`secretary`) — which has NO `workspaces.role.*` translation, so its label
 * falls back to the raw key (the contract for client-defined roles whose
 * bundle merge hasn't provided copy). */
const DEMO_ROLES = {
  roles: [
    { role: "owner", rank: 400, capabilities: ["*"], builtin: true },
    {
      role: "admin",
      rank: 300,
      capabilities: ["workspace.view", "members.*"],
      builtin: true,
    },
    {
      role: "secretary",
      rank: 250,
      capabilities: ["workspace.view", "members.view", "meetings.spotlight"],
      builtin: false,
    },
    {
      role: "member",
      rank: 200,
      capabilities: ["workspace.view", "members.view"],
      builtin: true,
    },
    {
      role: "viewer",
      rank: 100,
      capabilities: ["workspace.view", "members.view"],
      builtin: true,
    },
  ],
};

function RoleSelectDemo(): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={{ "/roles": DEMO_ROLES }}>
      <DemoCard heading="RoleSelect">
        <RoleSelect>
          {({ roles, labelFor }) => (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {roles.map((r) => (
                <li key={r.role}>
                  <span>{labelFor(r.role)}</span>{" "}
                  <code style={{ color: cssVar("text-muted") }}>
                    {r.role} · {r.rank}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </RoleSelect>
      </DemoCard>
    </WorkspacesDemoHarness>
  );
}

/**
 * Demonstrates the registry-driven role picker: the canned GET /roles carries
 * the builtin four plus a deployment `secretary` overlay role. Builtin labels
 * resolve via `workspaces.role.<key>`; the overlay role (no translation
 * merged) falls back to its raw name — pickable either way.
 */
export default defineDemo({
  id: "workspaces.role-select",
  title: "Role select (registry)",
  description:
    "The headless RoleSelect reads the effective role registry (builtin four + the deployment's STAPEL_WORKSPACES[\"ROLES\"] overlay) from GET /roles and resolves labels via workspaces.role.<key> with a raw-name fallback — role UI stops hardcoding the builtin four.",
  component: RoleSelect,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <RoleSelectDemo /> },
  },
});
