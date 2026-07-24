/** Can — capability gate over my_capabilities + the ported wildcard matcher. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { Can } from "../src/index.js";
import { WorkspacesDemoHarness, DemoCard } from "./_harness.js";

const WS = "0192f000-0000-4000-8000-000000000001";

/** The canned GET /{id} detail: an admin whose grants include a prefix
 * wildcard — `members.*` matches `members.invite` but not `meetings.kick`. */
const DEMO_WORKSPACE = {
  id: WS,
  name: "Acme Engineering",
  slug: "acme-eng",
  type: "work",
  owner_id: "0192a000-0000-4000-8000-000000000001",
  settings: {},
  storage_used_bytes: 0,
  storage_limit_bytes: 5368709120,
  member_count: 2,
  my_role: "admin",
  my_capabilities: ["workspace.view", "members.*"],
  created_at: "2026-05-20T10:00:00Z",
  updated_at: "2026-05-20T10:00:00Z",
};

function Verdict(props: { capability: string }): ReactElement {
  const t = useT();
  return (
    <Can capability={props.capability} workspaceId={WS}>
      {({ allowed }) => (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <code style={{ color: cssVar("text-muted") }}>{props.capability}</code>
          <span style={{ color: allowed ? cssVar("success") : cssVar("error") }}>
            {t(allowed ? "demo.label.allowed" : "demo.label.denied")}
          </span>
        </div>
      )}
    </Can>
  );
}

function CanDemo(): ReactElement {
  return (
    <WorkspacesDemoHarness handlers={{ [WS]: DEMO_WORKSPACE }}>
      <DemoCard heading="Can">
        <Verdict capability="members.invite" />
        <Verdict capability="members.role.change" />
        <Verdict capability="meetings.kick" />
      </DemoCard>
    </WorkspacesDemoHarness>
  );
}

/**
 * Demonstrates the capability gate: the canned workspace detail grants
 * `workspace.view` + the `members.*` prefix wildcard, so member operations
 * read allowed while a product capability (`meetings.kick`) is denied —
 * deny-by-default, exactly like the backend matcher this ports.
 */
export default defineDemo({
  id: "workspaces.can",
  title: "Capability gate",
  description:
    "The headless Can gates UI on the caller's my_capabilities in a workspace, with the backend's wildcard matcher (* and prefix.*) ported client-side. Static children render only when allowed; the render-prop variant hands the verdict out for disabled-state UI. UI convenience only — the backend re-checks every operation.",
  component: Can,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <CanDemo /> },
  },
});
