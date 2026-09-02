/**
 * Rename from the row-actions sheet — the two defects a live drive
 * e2e walked into on a live stand (2026-09-02), asserted at the pair:
 *
 *  1. **The listing the row came from must update.** The rename PATCH is the
 *     docs pair's write and invalidates only the DOCS keys; a FOLDER row is
 *     drawn from this pair's own per-rung read (`driveQueryKeys.children`),
 *     so without a drive-side invalidation the old name stayed on screen
 *     until a full reload. Same mechanism as create-folder and the upload
 *     queue: on success, drop the drive namespace.
 *
 *  2. **The sheet settles WITH the write, not before it.** The old handler
 *     fired the mutation and closed everything in the same tick — a refused
 *     rename vanished without a trace. Now the prompt stays up (busy) while
 *     the PATCH is in flight, everything closes only on success, and a
 *     refusal returns to the actions sheet with the refusal's own sentence.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DriveRowActions, DriveScreen } from "../src/default/index.js";
import { folderRow } from "../src/index.js";
import { WORKSPACE_ID, harness, wire } from "./helpers.js";
import type { RouteAnswer } from "./helpers.js";
import { DOC_A, FOLDER_A } from "./fixtures.js";

const RENAMED = { ...FOLDER_A, name: "Contracts 2026" };

const JSON_HEADERS = { "content-type": "application/json" } as const;

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** Walk the sheet to the rename prompt and confirm the new name. */
async function renameThroughSheet(actionsTestId: string): Promise<void> {
  fireEvent.click(await screen.findByTestId(actionsTestId));
  fireEvent.click(await screen.findByTestId("drive-action-rename"));
  fireEvent.change(await screen.findByTestId("docs-name-input"), {
    target: { value: RENAMED.name },
  });
  fireEvent.click(screen.getByTestId("docs-name-confirm"));
}

describe("rename from the row-actions sheet", () => {
  it("updates the visible folder name in the listing it came from — no reload", async () => {
    // The listing answers with the OLD name until the PATCH has landed, so
    // the new name can only appear through the refetch the invalidation
    // causes — never from a fixture that was always there.
    let renamed = false;
    const routes: Record<string, RouteAnswer> = {
      [`PATCH /folders/${FOLDER_A.id}`]: () => {
        renamed = true;
        return ok(RENAMED);
      },
      "/folders": () => ok(renamed ? [RENAMED] : [FOLDER_A]),
      "/documents": { body: [DOC_A] },
      "/starred": { body: { folders: [], documents: [] } },
      "/recents": { body: [] },
    };
    const stub = wire(routes);
    const { wrapper } = harness(stub);
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    await screen.findByTestId(`drive-row-${FOLDER_A.id}`);

    await renameThroughSheet(`drive-actions-${FOLDER_A.id}`);

    // The row shows the NEW name without any remount of the screen…
    await waitFor(() => {
      expect(
        screen.getByTestId(`drive-row-${FOLDER_A.id}`).textContent
      ).toContain(RENAMED.name);
    });
    // …because the drive listing was refetched after the PATCH, not because
    // anything reloaded.
    const listingReads = stub.calls.filter(
      (call) => call.method === "GET" && call.pathname.endsWith("/folders")
    );
    expect(listingReads.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps everything open while the PATCH is in flight and closes on success", async () => {
    const gate: { resolve: ((response: Response) => void) | null } = {
      resolve: null,
    };
    const routes: Record<string, RouteAnswer> = {
      [`PATCH /folders/${FOLDER_A.id}`]: () =>
        new Promise<Response>((resolve) => {
          gate.resolve = resolve;
        }),
      "/folders": { body: [FOLDER_A] },
    };
    const stub = wire(routes);
    const onClose = vi.fn();
    const { wrapper } = harness(stub);
    render(
      <DriveRowActions
        workspaceId={WORKSPACE_ID}
        row={folderRow(FOLDER_A)}
        onClose={onClose}
      />,
      { wrapper }
    );

    await renameThroughSheet("drive-row-actions");
    // The wire has the PATCH…
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === "PATCH")
      ).toBe(true);
    });
    // …and NOTHING has closed yet: a sheet that closes before the server
    // answers cannot stay open on a refusal.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("docs-name-input")).toBeDefined();

    gate.resolve?.(ok(RENAMED));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("stays open on a refusal, with the refusal's reason on the sheet", async () => {
    const routes: Record<string, RouteAnswer> = {
      [`PATCH /folders/${FOLDER_A.id}`]: () =>
        ok({ localizable_error: "error.409.conflict" }, 409),
      "/folders": { body: [FOLDER_A] },
    };
    const onClose = vi.fn();
    const { wrapper } = harness(wire(routes));
    render(
      <DriveRowActions
        workspaceId={WORKSPACE_ID}
        row={folderRow(FOLDER_A)}
        onClose={onClose}
      />,
      { wrapper }
    );

    await renameThroughSheet("drive-row-actions");

    // The refusal lands back on the actions sheet as a sentence…
    const reason = await screen.findByTestId("drive-rename-error");
    expect((reason.textContent ?? "").length).toBeGreaterThan(0);
    // …and the sheet did NOT close: the person can retry or dismiss.
    expect(onClose).not.toHaveBeenCalled();
    // Retry is genuinely available — the rename prompt opens again.
    fireEvent.click(screen.getByTestId("drive-action-rename"));
    expect(await screen.findByTestId("docs-name-input")).toBeDefined();
  });
});
