import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useOwnersHealth } from "../src/index.js";
import { STAFF_ONLY, TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { OWNER_ALIVE, OWNER_MISMATCHED, OWNER_SILENT } from "./fixtures.js";

function Probe(): ReactElement {
  const bag = useOwnersHealth();
  return (
    <div>
      <span data-testid="load">{bag.rows.status}</span>
      <span data-testid="owners">
        {bag.rows.status === "ready"
          ? bag.rows.data.map((row) => row.owner).join(",")
          : ""}
      </span>
      <span data-testid="silent">
        {bag.silent.map((row) => row.owner).join(",")}
      </span>
      <span data-testid="mismatched">
        {bag.mismatched.map((row) => row.owner).join(",")}
      </span>
    </div>
  );
}

const mount = (server: MockServer): ReturnType<typeof render> =>
  render(
    <TestProviders server={server}>
      <Probe />
    </TestProviders>
  );

const ready = async (): Promise<void> => {
  await waitFor(() =>
    expect(screen.getByTestId("load").textContent).toBe("ready")
  );
};

describe("useOwnersHealth — silence is a row, not an absence", () => {
  it("keeps a silent owner IN the table it is missing from the answers of", async () => {
    // The table is built from the INVENTORY, not from who replied. A list
    // assembled from replies would look perfectly healthy exactly when the
    // deployment is at its most broken.
    const server = mockServer({
      "/owners/health": { body: [OWNER_ALIVE, OWNER_SILENT] },
    });
    mount(server);
    await ready();
    expect(screen.getByTestId("owners").textContent).toBe(
      "recordings,workspaces"
    );
    expect(screen.getByTestId("silent").textContent).toBe("workspaces");
  });

  it("takes `alive` from the server rather than re-deriving it from a timestamp", async () => {
    // The server compares last_alive_at against the deployment's
    // OWNER_ALIVE_MAX_AGE_HOURS. A client that guessed the threshold would
    // disagree with the boot check (`gdpr.W006`) that raises the same finding.
    const staleButAlive = {
      ...OWNER_ALIVE,
      alive: true,
      last_alive_at: "2020-01-01T00:00:00Z",
    };
    const server = mockServer({ "/owners/health": { body: [staleButAlive] } });
    mount(server);
    await ready();
    expect(screen.getByTestId("silent").textContent).toBe("");
  });

  it("names the third state: answering, but for a different set of subjects", async () => {
    const server = mockServer({
      "/owners/health": { body: [OWNER_ALIVE, OWNER_MISMATCHED] },
    });
    mount(server);
    await ready();
    // Not silent, so nothing alerts — but an erasure of the subject it stopped
    // claiming gets no receipt slot at all.
    expect(screen.getByTestId("silent").textContent).toBe("");
    expect(screen.getByTestId("mismatched").textContent).toBe("agent");
  });

  it("does not call a re-ordered subject list a mismatch", async () => {
    const reordered = {
      ...OWNER_ALIVE,
      answered_subject_types: ["recording", "meeting", "workspace", "account"],
    };
    const server = mockServer({ "/owners/health": { body: [reordered] } });
    mount(server);
    await ready();
    expect(screen.getByTestId("mismatched").textContent).toBe("");
  });

  it("an empty inventory is `ready` with no rows — the worst finding, not the best", async () => {
    const server = mockServer({ "/owners/health": { body: [] } });
    mount(server);
    await ready();
    expect(screen.getByTestId("owners").textContent).toBe("");
    expect(screen.getByTestId("silent").textContent).toBe("");
  });

  it("the staff refusal is a failure, never an empty operations table", async () => {
    const server = mockServer({ "/owners/health": STAFF_ONLY });
    mount(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("failed")
    );
    expect(screen.getByTestId("silent").textContent).toBe("");
  });
});
