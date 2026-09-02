/**
 * The product skin, rendered — the §54 half of the suite.
 *
 * These are not screenshot substitutes: each one asserts a property the skin
 * would silently lose (the tabs exist, the empty folder is a sentence and not
 * a blank, the quota banner is its own message, the sheet lists a folder's
 * actions without a download it cannot perform).
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StapelApiError } from "@stapel/core";
import {
  DriveRowActions,
  DriveScreen,
  StarredPane,
  UploadTrayPanel,
} from "../src/default/index.js";
import { documentRow, folderRow } from "../src/index.js";
import type { UploadItem, UploadTrayBag } from "../src/index.js";
import { WORKSPACE_ID, harness, wire } from "./helpers.js";
import { DOC_A, FOLDER_A } from "./fixtures.js";

const FULL = {
  "/folders": { body: [FOLDER_A] },
  "/documents": { body: [DOC_A] },
  "/starred": { body: { folders: [], documents: [] } },
  "/recents": { body: [] },
  "/trash": { body: { folders: [], documents: [] } },
};

function queue(items: readonly UploadItem[]): UploadTrayBag {
  return {
    items,
    add: () => undefined,
    retry: () => undefined,
    cancel: () => undefined,
    clearFinished: () => undefined,
    isUploading: false,
    quotaExceeded: items.some((item) => item.quotaExceeded),
  };
}

function item(patch: Partial<UploadItem> & { id: string }): UploadItem {
  return {
    name: "Warehouse.jpg",
    size: 2_400_000,
    status: "queued",
    loaded: 0,
    progress: 0,
    error: null,
    quotaExceeded: false,
    documentId: null,
    ...patch,
  };
}

describe("<DriveScreen/>", () => {
  it("draws the path strip, the rows and the four tabs", async () => {
    const { wrapper } = harness(wire(FULL));
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    expect(screen.getByTestId("drive-screen")).toBeDefined();
    expect(await screen.findByTestId("drive-breadcrumbs")).toBeDefined();
    await waitFor(() => {
      expect(screen.getByTestId(`drive-row-${FOLDER_A.id}`)).toBeDefined();
    });
    expect(screen.getByTestId(`drive-row-${DOC_A.id}`)).toBeDefined();
    expect(screen.getByTestId("drive-tabs")).toBeDefined();
    expect(screen.getByTestId("drive-view-toggle")).toBeDefined();
    expect(screen.getByTestId("drive-upload-fab")).toBeDefined();
  });

  it("says an empty folder is empty — a sentence, from a load that succeeded", async () => {
    const { wrapper } = harness(
      wire({ ...FULL, "/folders": { body: [] }, "/documents": { body: [] } })
    );
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    expect(await screen.findByTestId("drive-listing-empty")).toBeDefined();
  });

  it("shows the failure arm when the folder read fails — never an empty list", async () => {
    const { wrapper } = harness(
      wire({
        ...FULL,
        "/folders": { status: 503, body: { localizable_error: "stapel.http.503" } },
      })
    );
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    await waitFor(() => {
      expect(
        document.querySelector('[data-stapel-load-state="failed"]')
      ).not.toBeNull();
    });
    expect(screen.queryByTestId("drive-listing-empty")).toBeNull();
  });

  it("takes a host-owned upload queue and draws it", async () => {
    const { wrapper } = harness(wire(FULL));
    render(
      <DriveScreen
        workspaceId={WORKSPACE_ID}
        uploads={queue([item({ id: "u-1", status: "uploading", progress: 0.5 })])}
      />,
      { wrapper }
    );
    expect(await screen.findByTestId("drive-upload-tray")).toBeDefined();
    expect(screen.getByTestId("drive-upload-progress-u-1")).toBeDefined();
  });
});

describe("<UploadTrayPanel/>", () => {
  it("gives the workspace quota its own banner and withholds a Retry that cannot work", () => {
    const { wrapper } = harness(wire({}));
    render(
      <UploadTrayPanel
        bag={queue([
          item({
            id: "u-1",
            status: "failed",
            quotaExceeded: true,
            error: new StapelApiError({
              code: "error.507.docs_workspace_quota",
              message: "full",
              status: 507,
            }),
          }),
        ])}
      />,
      { wrapper }
    );
    expect(screen.getByTestId("drive-upload-quota")).toBeDefined();
    expect(screen.queryByTestId("drive-upload-retry-u-1")).toBeNull();
  });

  it("keeps the per-row Retry for a failure a retry CAN fix", () => {
    const { wrapper } = harness(wire({}));
    render(
      <UploadTrayPanel
        bag={queue([
          item({
            id: "u-2",
            status: "failed",
            error: new StapelApiError({
              code: "stapel.http.502",
              message: "bad gateway",
              status: 502,
            }),
          }),
        ])}
      />,
      { wrapper }
    );
    expect(screen.queryByTestId("drive-upload-quota")).toBeNull();
    expect(screen.getByTestId("drive-upload-retry-u-2")).toBeDefined();
  });
});

describe("<DriveRowActions/>", () => {
  it("offers download for a document", async () => {
    const { wrapper } = harness(wire({ "/folders": { body: [] } }));
    render(
      <DriveRowActions
        workspaceId={WORKSPACE_ID}
        row={documentRow(DOC_A)}
        onClose={() => undefined}
      />,
      { wrapper }
    );
    expect(await screen.findByTestId("drive-action-download")).toBeDefined();
  });

  it("omits download for a folder — there is no endpoint that answers its bytes", async () => {
    const { wrapper } = harness(wire({ "/folders": { body: [] } }));
    render(
      <DriveRowActions
        workspaceId={WORKSPACE_ID}
        row={folderRow(FOLDER_A)}
        onClose={() => undefined}
      />,
      { wrapper }
    );
    expect(await screen.findByTestId("drive-action-rename")).toBeDefined();
    expect(screen.queryByTestId("drive-action-download")).toBeNull();
  });
});

describe("<StarredPane/>", () => {
  it("distinguishes an empty list from a failed read", async () => {
    const empty = harness(wire({ "/starred": { body: { folders: [], documents: [] } } }));
    const { unmount } = render(
      <StarredPane
        workspaceId={WORKSPACE_ID}
        onOpen={() => undefined}
        onActions={() => undefined}
      />,
      { wrapper: empty.wrapper }
    );
    expect(await screen.findByTestId("drive-starred-empty")).toBeDefined();
    unmount();

    const failed = harness(
      wire({ "/starred": { status: 503, body: { localizable_error: "stapel.http.503" } } })
    );
    render(
      <StarredPane
        workspaceId={WORKSPACE_ID}
        onOpen={() => undefined}
        onActions={() => undefined}
      />,
      { wrapper: failed.wrapper }
    );
    await waitFor(() => {
      expect(
        document.querySelector('[data-stapel-load-state="failed"]')
      ).not.toBeNull();
    });
    expect(screen.queryByTestId("drive-starred-empty")).toBeNull();
  });
});
