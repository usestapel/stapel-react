/**
 * `<FormsListPane>` — create, configure, delete.
 *
 * The delete is the one worth guarding: `DELETE /forms/<id>` is a soft-delete
 * that ALSO closes an open form (`services.delete_form` emits `form.closed`),
 * so the public link stops resolving the moment it returns. A confirmation
 * that does not say that is a confirmation of the wrong thing.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormsListPane } from "../src/default/index.js";
import { mockServer, TestHarness } from "./harness.js";
import type { MockServer } from "./harness.js";
import { FORM_ID, formRow, WORKSPACE_ID } from "./fixtures.js";

function renderPane(rows: unknown[], deleteResult = { status: 204 }): {
  server: MockServer;
} {
  // Needles are matched as substrings of the WHOLE url, and the base itself
  // is `…/forms/api/v1/` — so a bare "/forms/" would match the list call too.
  const server = mockServer({
    "DELETE /v1/forms/": deleteResult,
    "GET /v1/forms?": { body: rows },
  });
  render(
    <TestHarness server={server} workspaceId={WORKSPACE_ID}>
      <FormsListPane />
    </TestHarness>
  );
  return { server };
}

describe("deleting a form", () => {
  it("names the consequence for an OPEN form before it happens", async () => {
    renderPane([formRow({ state: "open", submission_count: 240 })]);
    await screen.findByTestId(`forms-list-row-${FORM_ID}`);
    fireEvent.click(screen.getByTestId(`forms-list-delete-${FORM_ID}`));

    // Not "are you sure?" — the two facts a person needs to decide, read out
    // of the confirmation itself (the row behind it also says "240 responses").
    const body = document.querySelector('[data-stapel-confirm]');
    expect(body?.textContent).toContain("This form is OPEN");
    expect(body?.textContent).toContain("240 response");
  });

  it("says something different about a form that is not open", async () => {
    renderPane([formRow({ state: "draft", submission_count: 0 })]);
    await screen.findByTestId(`forms-list-row-${FORM_ID}`);
    fireEvent.click(screen.getByTestId(`forms-list-delete-${FORM_ID}`));
    const body = document.querySelector('[data-stapel-confirm]');
    expect(body?.textContent).not.toContain("This form is OPEN");
    expect(body?.textContent).toContain("stop being reachable");
  });

  it("sends the DELETE only after the confirmation is confirmed", async () => {
    const { server } = renderPane([formRow()]);
    await screen.findByTestId(`forms-list-row-${FORM_ID}`);

    fireEvent.click(screen.getByTestId(`forms-list-delete-${FORM_ID}`));
    expect(server.calls.some((c) => c.method === "DELETE")).toBe(false);

    fireEvent.click(screen.getByTestId("stapel-confirm-ok"));
    await waitFor(() => {
      expect(server.calls.some((c) => c.method === "DELETE")).toBe(true);
    });
    const call = server.calls.find((c) => c.method === "DELETE");
    // Workspace-scoped like every other admin call.
    expect(call?.url).toContain(`workspace_id=${WORKSPACE_ID}`);
    expect(call?.url).toContain(FORM_ID);
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    const { server } = renderPane([formRow()]);
    await screen.findByTestId(`forms-list-row-${FORM_ID}`);
    fireEvent.click(screen.getByTestId(`forms-list-delete-${FORM_ID}`));
    fireEvent.click(screen.getByTestId("stapel-confirm-cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("stapel-confirm-ok")).toBeNull();
    });
    expect(server.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("is a DANGER confirmation — cancel is the safe default", async () => {
    renderPane([formRow()]);
    await screen.findByTestId(`forms-list-row-${FORM_ID}`);
    fireEvent.click(screen.getByTestId(`forms-list-delete-${FORM_ID}`));
    expect(
      document.querySelector('[data-stapel-confirm="danger"]')
    ).toBeTruthy();
  });
});

describe("the settings door", () => {
  it("opens the form-settings surface for THAT row", async () => {
    const server = mockServer({
      "GET /v1/forms?": { body: [formRow()] },
      "GET /v1/forms/": { body: formRow() },
    });
    render(
      <TestHarness server={server} workspaceId={WORKSPACE_ID}>
        <FormsListPane />
      </TestHarness>
    );
    await screen.findByTestId(`forms-list-row-${FORM_ID}`);
    fireEvent.click(screen.getByTestId(`forms-list-settings-${FORM_ID}`));
    expect(await screen.findByTestId("forms-settings-form")).toBeTruthy();
  });
});

describe("the empty state", () => {
  it("is reachable only from a load that SUCCEEDED, and offers the way out", async () => {
    renderPane([]);
    const empty = await screen.findByTestId("forms-list-empty");
    expect(empty.textContent).toContain("No forms in this workspace yet");
    // An empty state with no action is a dead end.
    expect(empty.textContent).toContain("New form");
  });
});

describe("the workspace a routed screen acts in", () => {
  it("says so instead of listing nothing when nobody declared one", () => {
    const server = mockServer({});
    render(
      <TestHarness server={server}>
        <FormsListPane />
      </TestHarness>
    );
    expect(screen.getByTestId("forms-list-no-workspace")).toBeTruthy();
    expect(server.calls).toHaveLength(0);
  });

  it("lets an explicit prop outrank the runtime's default", async () => {
    const other = "9dd37c75-1828-4673-c4ad-3d074f77b112";
    const server = mockServer({ "GET /v1/forms?": { body: [] } });
    render(
      <TestHarness server={server} workspaceId={WORKSPACE_ID}>
        <FormsListPane workspaceId={other} />
      </TestHarness>
    );
    await screen.findByTestId("forms-list-empty");
    expect(server.calls[0]?.url).toContain(`workspace_id=${other}`);
  });
});
