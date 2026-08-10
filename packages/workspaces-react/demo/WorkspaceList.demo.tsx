/** WorkspaceList — headless list of the caller's workspaces + create control. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { matchList } from "@stapel/core";
import { WorkspaceList } from "../src/index.js";
import {
  WorkspacesDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

/** The list the canned GET / handler returns. */
const DEMO_LIST = {
  workspaces: [
    {
      id: "0192f000-0000-4000-8000-000000000001",
      name: "Acme Engineering",
      slug: "acme-eng",
      type: "work",
      owner_id: "0192a000-0000-4000-8000-000000000001",
      settings: {},
      storage_used_bytes: 0,
      storage_limit_bytes: 5368709120,
      member_count: 4,
      my_role: "owner",
      created_at: "2026-05-20T10:00:00Z",
      updated_at: "2026-05-20T10:00:00Z",
    },
  ],
};

function WorkspaceListBody(): ReactElement {
  return (
    <DemoCard heading="WorkspaceList">
      <WorkspaceList>
        {({ state, isCreating, create }) => (
          <>
            <StepBadge
              step={matchList(state, {
                loading: () => "loading",
                failed: () => "could not load your workspaces",
                empty: () => "no workspaces yet",
                ready: (workspaces) => `${workspaces.length} workspace(s)`,
              })}
            />
            <DemoActions>
              <DemoButton
                run={() => {
                  create({ name: "New workspace", type: "work" });
                }}
                labelKey={
                  isCreating
                    ? "workspaces.list.creating"
                    : "workspaces.list.create"
                }
              />
            </DemoActions>
          </>
        )}
      </WorkspaceList>
    </DemoCard>
  );
}

function WorkspaceListDemo(): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={{ "/workspaces/api/": DEMO_LIST }}>
      <WorkspaceListBody />
    </WorkspacesDemoHarness>
  );
}

/**
 * Demonstrates the headless workspace list: the canned handler returns the
 * caller's workspaces for GET /, and the create button POSTs a new one. Bring
 * your own list + create form — the component is renderless.
 */
export default defineDemo({
  id: "workspaces.list",
  title: "Workspace list",
  description:
    "The headless WorkspaceList wraps the read of the caller's workspaces plus an owner-seeded create. The read arrives as a LoadState the skin renders through matchList, so 'no workspaces yet' and 'we could not load them' stay two different screens. Bring your own UI — the component is renderless.",
  component: WorkspaceList,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <WorkspaceListDemo /> },
  },
});
