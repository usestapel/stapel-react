/**
 * The FAB's action sheet + folder creation (owner escalation 2026-09-02).
 *
 * The FAB used to open the file picker DIRECTLY, which made "new folder"
 * impossible from the drive product at all — the docs pair has the mutation
 * (`useCreateFolder`), the desktop `FolderTreePane` has the affordance, and
 * this screen had neither. Now the FAB opens the pair's bottom sheet (the
 * same `SkinDialog` shape `DriveRowActions` uses) with two actions:
 *
 *  - **upload files** — the existing behaviour, one tap deeper: it triggers
 *    the same hidden `<input type="file">`;
 *  - **new folder** — the docs pair's `NameDialog` (exactly the rename
 *    prompt's shape) calling `useCreateFolder` with the CURRENT folder as
 *    the parent, then invalidating the drive listing so the row appears.
 *
 * One affordance, one behaviour: the empty state's upload button opens the
 * SAME sheet — it must not remain a second, bare picker beside a FAB that
 * grew a menu.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DriveScreen } from "../src/default/index.js";
import { WORKSPACE_ID, harness, wire } from "./helpers.js";
import type { RouteAnswer } from "./helpers.js";
import { DOC_A, FOLDER_A } from "./fixtures.js";

const NEW_FOLDER = {
  ...FOLDER_A,
  id: "f-new",
  name: "Q3 reports",
};

/** The standard screen routes, with a live POST /folders that makes the new
 * folder appear in the NEXT folder listing — so the row the test asserts is
 * the row the invalidation actually refetched, not a fixture that was always
 * there. */
function routesWithCreate(): {
  routes: Record<string, RouteAnswer>;
  created: () => boolean;
} {
  let created = false;
  const routes: Record<string, RouteAnswer> = {
    "POST /folders": () => {
      created = true;
      return new Response(JSON.stringify(NEW_FOLDER), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
    "/folders": () =>
      new Response(JSON.stringify(created ? [FOLDER_A, NEW_FOLDER] : [FOLDER_A]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    "/documents": { body: [DOC_A] },
    "/starred": { body: { folders: [], documents: [] } },
    "/recents": { body: [] },
    "/trash": { body: { folders: [], documents: [] } },
  };
  return { routes, created: () => created };
}

describe("the FAB action sheet", () => {
  it("opens the sheet with both actions — not the bare file picker", async () => {
    const { routes } = routesWithCreate();
    const { wrapper } = harness(wire(routes));
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    await screen.findByTestId(`drive-row-${FOLDER_A.id}`);

    fireEvent.click(screen.getByTestId("drive-upload-fab"));
    const sheet = await screen.findByTestId("drive-create-sheet");
    expect(within(sheet).getByTestId("drive-create-upload")).toBeDefined();
    expect(within(sheet).getByTestId("drive-create-folder")).toBeDefined();
  });

  it("its upload action reaches the hidden input — the existing picker, one tap deeper", async () => {
    const { routes } = routesWithCreate();
    const { wrapper } = harness(wire(routes));
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    await screen.findByTestId(`drive-row-${FOLDER_A.id}`);

    const input = screen.getByTestId("drive-upload-input");
    const picked = vi.fn();
    input.addEventListener("click", picked);

    fireEvent.click(screen.getByTestId("drive-upload-fab"));
    fireEvent.click(await screen.findByTestId("drive-create-upload"));
    expect(picked).toHaveBeenCalledTimes(1);
    // The sheet closed behind the picker.
    await waitFor(() => {
      expect(screen.queryByTestId("drive-create-sheet")).toBeNull();
    });
  });

  it("creates a folder in the CURRENT folder and the new row appears from the refetch", async () => {
    const { routes } = routesWithCreate();
    const stub = wire(routes);
    const { wrapper } = harness(stub);
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    await screen.findByTestId(`drive-row-${FOLDER_A.id}`);

    fireEvent.click(screen.getByTestId("drive-upload-fab"));
    fireEvent.click(await screen.findByTestId("drive-create-folder"));

    const name = await screen.findByTestId("docs-name-input");
    fireEvent.change(name, { target: { value: "Q3 reports" } });
    fireEvent.click(screen.getByTestId("docs-name-confirm"));

    // The wire saw the docs pair's create, parented at the CURRENT folder
    // (the root here — the drive spells it null on the wire).
    await waitFor(() => {
      const post = stub.calls.find(
        (call) => call.method === "POST" && call.pathname.endsWith("/folders")
      );
      expect(post).toBeDefined();
      expect(JSON.parse(post?.body ?? "{}")).toEqual({
        workspace_id: WORKSPACE_ID,
        name: "Q3 reports",
        parent_id: null,
      });
    });

    // The invalidation refetched the listing and the row is REAL — it came
    // off the wire's post-create answer.
    expect(await screen.findByTestId(`drive-row-${NEW_FOLDER.id}`)).toBeDefined();
  });

  it("the empty state's upload button opens the SAME sheet — one affordance, one behaviour", async () => {
    const { wrapper } = harness(
      wire({
        "/folders": { body: [] },
        "/documents": { body: [] },
        "/starred": { body: { folders: [], documents: [] } },
        "/recents": { body: [] },
        "/trash": { body: { folders: [], documents: [] } },
      })
    );
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    const empty = await screen.findByTestId("drive-listing-empty");

    fireEvent.click(within(empty).getByTestId("drive-empty-upload"));
    expect(await screen.findByTestId("drive-create-sheet")).toBeDefined();
  });
});
