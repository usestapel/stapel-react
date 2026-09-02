/**
 * THE RUNG DISCIPLINE, asserted on the wire.
 *
 * The categories cascade rule the spec adopts (§1.6/§4) is not a style: a
 * drive that syncs the tree makes one request proportional to the whole
 * workspace on every open, and the failure is invisible in a fixture with two
 * folders. So this file counts REQUESTS and reads their query strings — the
 * only place the difference between "one rung" and "the tree" is observable.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DriveList } from "../src/index.js";
import { WORKSPACE_ID, harness, wire } from "./helpers.js";
import { DOC_A, DOC_B, DOC_IN_FOLDER, FOLDER_A, FOLDER_B } from "./fixtures.js";

function rowsOf(): string[] {
  return screen
    .getAllByTestId("row")
    .map((node) => node.textContent ?? "")
    .filter((text) => text.length > 0);
}

describe("DriveList — server-driven children, one rung per request", () => {
  it("reads exactly two lists per folder open: its folders and its documents", async () => {
    const stub = wire({
      "/folders": { body: [FOLDER_B] },
      "/documents": { body: [DOC_A] },
    });
    const { wrapper } = harness(stub);
    render(
      <DriveList workspaceId={WORKSPACE_ID} folderId={FOLDER_A.id}>
        {({ state }) => (
          <div data-testid="state">
            {state.status === "ready" ? String(state.data.length) : state.status}
          </div>
        )}
      </DriveList>,
      { wrapper }
    );
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("2");
    });
    expect(stub.calls).toHaveLength(2);
    const folderCall = stub.calls.find((call) => call.pathname.endsWith("/folders"));
    const documentCall = stub.calls.find((call) =>
      call.pathname.endsWith("/documents")
    );
    // Both are SCOPED. A tree sync would be a /folders call with no parent_id.
    expect(folderCall?.search).toContain(`parent_id=${FOLDER_A.id}`);
    expect(documentCall?.search).toContain(`folder_id=${FOLDER_A.id}`);
  });

  it("never prefetches a folder nobody opened", async () => {
    const stub = wire({
      "/folders": { body: [FOLDER_A, FOLDER_B] },
      "/documents": { body: [] },
    });
    const { wrapper } = harness(stub);
    render(
      <DriveList workspaceId={WORKSPACE_ID} folderId={null}>
        {({ state }) => (
          <div data-testid="state">
            {state.status === "ready" ? String(state.data.length) : state.status}
          </div>
        )}
      </DriveList>,
      { wrapper }
    );
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("2");
    });
    // Two children were listed; two rungs were NOT then fetched behind them.
    expect(
      stub.calls.filter((call) => call.pathname.endsWith("/folders"))
    ).toHaveLength(1);
  });

  it("puts folders before documents, keeping the server's order inside each group", async () => {
    const stub = wire({
      "/folders": { body: [FOLDER_B, FOLDER_A] },
      "/documents": { body: [DOC_B, DOC_A] },
    });
    const { wrapper } = harness(stub);
    render(
      <DriveList workspaceId={WORKSPACE_ID} folderId="f-x">
        {({ state }) =>
          state.status === "ready" ? (
            <ul>
              {state.data.map((row) => (
                <li key={`${row.kind}:${row.id}`} data-testid="row">
                  {`${row.kind}:${row.name}`}
                </li>
              ))}
            </ul>
          ) : (
            <div data-testid="pending">{state.status}</div>
          )
        }
      </DriveList>,
      { wrapper }
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("row")).toHaveLength(4);
    });
    expect(rowsOf()).toEqual([
      `folder:${FOLDER_B.name}`,
      `folder:${FOLDER_A.name}`,
      `document:${DOC_B.title}`,
      `document:${DOC_A.title}`,
    ]);
  });

  it("at the ROOT, drops documents that live in a folder", async () => {
    // The backend gap this filter exists for: `GET /documents?folder_id=` is a
    // UUIDField, so there is no wire spelling for "no folder", and an absent
    // parameter means the whole workspace. Without the filter, "/" would list
    // every file in every folder.
    const stub = wire({
      "/folders": { body: [] },
      "/documents": { body: [DOC_A, DOC_IN_FOLDER] },
    });
    const { wrapper } = harness(stub);
    render(
      <DriveList workspaceId={WORKSPACE_ID} folderId={null}>
        {({ state }) =>
          state.status === "ready" ? (
            <ul>
              {state.data.map((row) => (
                <li key={row.id} data-testid="row">
                  {row.name}
                </li>
              ))}
            </ul>
          ) : (
            <div data-testid="pending">{state.status}</div>
          )
        }
      </DriveList>,
      { wrapper }
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("row")).toHaveLength(1);
    });
    expect(rowsOf()).toEqual([DOC_A.title]);
  });

  it("a failed half fails the whole listing — a slow sibling never masks an error", async () => {
    const stub = wire({
      "/folders": { status: 503, body: { localizable_error: "stapel.http.503" } },
      "/documents": { body: [DOC_A] },
    });
    const { wrapper } = harness(stub);
    render(
      <DriveList workspaceId={WORKSPACE_ID} folderId={null}>
        {({ state }) => <div data-testid="state">{state.status}</div>}
      </DriveList>,
      { wrapper }
    );
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("failed");
    });
  });
});
