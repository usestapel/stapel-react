/**
 * Share-sheet render stability (live drive e2e walk, 2026-09-02).
 *
 * On the live stand the share sheet kept re-rendering while its data
 * settled — enough to starve Playwright's actionability check on the mint
 * button. The churn was not the sheet's own two reads: opening ANY row's
 * actions also fired the docs pair's whole-tree `useFolders` (the move
 * picker's read, despite the comment saying it runs only while the move
 * prompt is open), and a document row also mounted `RevisionsModal`, whose
 * ungated `useDocument` reads `GET /documents/:id` while the modal is
 * closed. Every stray read is a query that lands mid-window and re-renders
 * the whole sheet subtree again.
 *
 * The contract, machine-checked here:
 *  - the actions sheet itself costs NO request — the row was on screen;
 *  - the Share prompt reads exactly its two listings;
 *  - once the share data has settled, the sheet STOPS rendering (probe
 *    component counts commits; late-landing strays would keep it moving).
 */
import { describe, expect, it } from "vitest";
import { Profiler } from "react";
import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DriveRowActions } from "../src/default/index.js";
import { documentRow, folderRow } from "../src/index.js";
import { WORKSPACE_ID, harness, wire } from "./helpers.js";
import type { RouteAnswer } from "./helpers.js";
import { DOC_A, FOLDER_A, GRANT_A, LINK_A } from "./fixtures.js";

const JSON_HEADERS = { "content-type": "application/json" } as const;

/** Answer after a beat — a read that lands AFTER the sheet's own settle. */
function late(body: unknown, ms: number): RouteAnswer {
  return () =>
    new Promise<Response>((resolve) => {
      setTimeout(() => {
        resolve(
          new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS })
        );
      }, ms);
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("the share sheet settles and stays settled", () => {
  it("opening the actions sheet costs no request — the row was on screen", async () => {
    const stub = wire({ "/folders": { body: [FOLDER_A] } });
    const { wrapper } = harness(stub);
    render(
      <DriveRowActions
        workspaceId={WORKSPACE_ID}
        row={folderRow(FOLDER_A)}
        onClose={() => undefined}
      />,
      { wrapper }
    );
    await screen.findByTestId("drive-action-rename");
    await sleep(50);
    expect(stub.calls).toHaveLength(0);
  });

  it("the Share prompt reads exactly its two listings — no tree, no document re-read", async () => {
    const stub = wire({
      "/access": { body: [GRANT_A] },
      "/links": { body: [LINK_A] },
      "/folders": { body: [FOLDER_A] },
      [`/documents/${DOC_A.id}`]: { body: DOC_A },
    });
    const { wrapper } = harness(stub);
    render(
      <DriveRowActions
        workspaceId={WORKSPACE_ID}
        row={documentRow(DOC_A)}
        onClose={() => undefined}
      />,
      { wrapper }
    );
    fireEvent.click(await screen.findByTestId("drive-action-share"));
    await screen.findByTestId(`drive-share-link-${LINK_A.id}`);
    await sleep(50);
    const paths = stub.calls.map((call) => `${call.method} ${call.pathname}`);
    expect(paths.filter((path) => path.endsWith("/access"))).toHaveLength(1);
    expect(paths.filter((path) => path.endsWith("/links"))).toHaveLength(1);
    expect(paths.filter((path) => path.endsWith("/folders"))).toHaveLength(0);
    expect(
      paths.filter((path) => path === `GET /docs/api/v1/documents/${DOC_A.id}`)
    ).toHaveLength(0);
  });

  it("render count is stable once the share data has settled", async () => {
    let commits = 0;
    const stub = wire({
      // The sheet's own two reads answer at once…
      "/access": { body: [GRANT_A] },
      "/links": { body: [LINK_A] },
      // …while the reads the sheet has NO business firing answer late. If
      // they run at all, they land after the settle and move the tree again
      // — exactly the churn the live stand starved on.
      "/folders": late([FOLDER_A], 250),
      [`/documents/${DOC_A.id}`]: late(DOC_A, 250),
    });
    const { wrapper } = harness(stub);
    const probe = (): ReactElement => (
      <Profiler
        id="share-sheet-probe"
        onRender={() => {
          commits += 1;
        }}
      >
        <DriveRowActions
          workspaceId={WORKSPACE_ID}
          row={documentRow(DOC_A)}
          onClose={() => undefined}
        />
      </Profiler>
    );
    render(probe(), { wrapper });
    fireEvent.click(await screen.findByTestId("drive-action-share"));
    await screen.findByTestId(`drive-share-link-${LINK_A.id}`);
    await screen.findByTestId(`drive-share-grant-${GRANT_A.id}`);
    await sleep(50); // let the settle's own commits flush
    const settled = commits;
    await sleep(400); // the window where a stray late read would land
    expect(commits).toBe(settled);
  });
});
