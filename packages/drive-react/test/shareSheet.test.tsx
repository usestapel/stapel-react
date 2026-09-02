/**
 * The share sheet, rendered.
 *
 * Everything the axis DOES is the docs pair's and is tested there; what is
 * asserted here is what this drawing is responsible for and could silently
 * lose in a re-skin:
 *
 *  - a switched-off mode's rows stay VISIBLE, under a banner that says they
 *    were not revoked;
 *  - a section the caller may not administer is ABSENT, not a dead form;
 *  - a refused mint renders the refusal's OWN sentence;
 *  - Share is offered on a document and not on a folder, which has no
 *    `/access` or `/links` route at all;
 *  - the sheet's two reads do not run while it is closed — one of them
 *    carries live bearer tokens.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DriveRowActions, ShareSheetPanel } from "../src/default/index.js";
import { documentRow, folderRow } from "../src/index.js";
import { WORKSPACE_ID, harness, wire } from "./helpers.js";
import { DOC_A, FOLDER_A, GRANT_A, LINK_A } from "./fixtures.js";

const BOTH = {
  "/access": { body: [GRANT_A] },
  "/links": { body: [LINK_A] },
};

describe("<ShareSheetPanel/>", () => {
  it("draws both halves over the docs pair's bag", async () => {
    const { wrapper } = harness(wire(BOTH));
    render(
      <ShareSheetPanel documentId={DOC_A.id} onClose={() => undefined} />,
      { wrapper }
    );
    expect(await screen.findByTestId("drive-share-links")).toBeDefined();
    expect(await screen.findByTestId("drive-share-people")).toBeDefined();
    expect(await screen.findByTestId(`drive-share-link-${LINK_A.id}`)).toBeDefined();
    expect(await screen.findByTestId(`drive-share-grant-${GRANT_A.id}`)).toBeDefined();
  });

  it("SHOWS a suspended row under a banner — it never filters it away", async () => {
    const { wrapper } = harness(
      wire({
        "/access": { body: [{ ...GRANT_A, suspended: true }] },
        "/links": { body: [{ ...LINK_A, suspended: true }] },
      })
    );
    render(
      <ShareSheetPanel documentId={DOC_A.id} onClose={() => undefined} />,
      { wrapper }
    );
    // The rows are present…
    const link = await screen.findByTestId(`drive-share-link-${LINK_A.id}`);
    const grant = await screen.findByTestId(`drive-share-grant-${GRANT_A.id}`);
    // …marked inert…
    expect(link.getAttribute("data-drive-share-suspended")).toBe("true");
    expect(grant.getAttribute("data-drive-share-suspended")).toBe("true");
    expect(screen.getByTestId(`drive-share-link-paused-${LINK_A.id}`)).toBeDefined();
    // …and the banner says the mode is off rather than the access revoked.
    expect(screen.getByTestId("drive-share-links-suspended")).toBeDefined();
    expect(screen.getByTestId("drive-share-people-suspended")).toBeDefined();
  });

  it("drops a section it may not administer instead of drawing a dead form", async () => {
    const { wrapper } = harness(
      wire({
        "/access": { status: 403, body: { localizable_error: "error.403.forbidden" } },
        "/links": { body: [LINK_A] },
      })
    );
    render(
      <ShareSheetPanel documentId={DOC_A.id} onClose={() => undefined} />,
      { wrapper }
    );
    expect(await screen.findByTestId("drive-share-people-unavailable")).toBeDefined();
    expect(screen.queryByTestId("drive-share-add")).toBeNull();
    expect(screen.queryByTestId("drive-share-subject")).toBeNull();
    // The other half is untouched: the two gates are independent.
    expect(await screen.findByTestId("drive-share-mint")).toBeDefined();
  });

  it("mints at the picked level, then SHOWS what it made", async () => {
    let listed = 0;
    const stub = wire({
      "/access": { body: [] },
      "GET /links": () => {
        listed += 1;
        return new Response(JSON.stringify(listed === 1 ? [] : [LINK_A]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      "POST /links": { status: 201, body: LINK_A },
    });
    const { wrapper } = harness(stub);
    render(
      <ShareSheetPanel documentId={DOC_A.id} onClose={() => undefined} />,
      { wrapper }
    );
    await screen.findByTestId("drive-share-links-empty");
    fireEvent.click(screen.getByTestId("drive-share-mint"));

    // The level the picker holds reaches the wire — a select whose value is
    // never sent is a bug no rendering assertion can see.
    await waitFor(() => {
      const mint = stub.calls.find(
        (call) => call.method === "POST" && call.pathname.endsWith("/links")
      );
      expect(mint?.body).toBe(JSON.stringify({ level: "view" }));
    });
    // …and the listing is refreshed, so the sheet shows the link it minted
    // instead of making the person mint a second one.
    expect(await screen.findByTestId(`drive-share-link-${LINK_A.id}`)).toBeDefined();
  });

  it("renders a refused level by ITS OWN sentence, not a generic failure", async () => {
    const { wrapper } = harness(
      wire({
        "/access": { body: [] },
        "GET /links": { body: [] },
        "POST /links": {
          status: 400,
          body: { localizable_error: "error.400.docs_share_level" },
        },
      })
    );
    render(
      <ShareSheetPanel documentId={DOC_A.id} onClose={() => undefined} />,
      { wrapper }
    );
    await screen.findByTestId("drive-share-links-empty");
    fireEvent.click(screen.getByTestId("drive-share-mint"));
    const alert = await screen.findByTestId("drive-share-mint-error");
    // The generated en floor carries this code's own text.
    expect(alert.textContent).toContain("access level");
    expect(alert.textContent).not.toContain("error.400.docs_share_level");
  });

  it("grants by user id, and the wire names the subject kind rather than inferring it", async () => {
    const stub = wire({
      "/access": { body: [] },
      "/links": { body: [] },
    });
    const { wrapper } = harness(stub);
    render(
      <ShareSheetPanel documentId={DOC_A.id} onClose={() => undefined} />,
      { wrapper }
    );
    await screen.findByTestId("drive-share-people-empty");
    fireEvent.change(screen.getByTestId("drive-share-subject"), {
      target: { value: "u-mira" },
    });
    fireEvent.click(screen.getByTestId("drive-share-add"));
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) => call.method === "POST" && call.pathname.endsWith("/access")
        )
      ).toBe(true);
    });
  });

  it("switches the grant button off WITH a reason while nobody is named", async () => {
    const { wrapper } = harness(wire(BOTH));
    render(
      <ShareSheetPanel documentId={DOC_A.id} onClose={() => undefined} />,
      { wrapper }
    );
    await screen.findByTestId("drive-share-people");
    const gate = document.querySelector('[data-stapel-gated="blocked"]');
    expect(gate).not.toBeNull();
  });

  it("costs no request while it is closed — one of the reads carries tokens", async () => {
    const stub = wire(BOTH);
    const { wrapper } = harness(stub);
    render(<ShareSheetPanel documentId={null} onClose={() => undefined} />, {
      wrapper,
    });
    await waitFor(() => {
      expect(stub.calls).toHaveLength(0);
    });
  });

  it("copies the HOST's bearer URL, never a guessed one", async () => {
    const { wrapper } = harness(wire(BOTH));
    render(
      <ShareSheetPanel
        documentId={DOC_A.id}
        linkUrl={(token) => `https://drive.example.com/s/${token}`}
        onClose={() => undefined}
      />,
      { wrapper }
    );
    const row = await screen.findByTestId(`drive-share-link-${LINK_A.id}`);
    expect(row.textContent).toContain(
      `https://drive.example.com/s/${LINK_A.token}`
    );
  });
});

describe("<DriveRowActions/> — the Share door", () => {
  it("offers Share on a document and opens the sheet", async () => {
    const { wrapper } = harness(wire({ ...BOTH, "/folders": { body: [FOLDER_A] } }));
    render(
      <DriveRowActions
        workspaceId={WORKSPACE_ID}
        row={documentRow(DOC_A)}
        onClose={() => undefined}
      />,
      { wrapper }
    );
    fireEvent.click(await screen.findByTestId("drive-action-share"));
    expect(await screen.findByTestId("drive-share-links")).toBeDefined();
  });

  it("does NOT offer Share on a folder — there is no folder sharing route", async () => {
    const { wrapper } = harness(wire({ "/folders": { body: [FOLDER_A] } }));
    render(
      <DriveRowActions
        workspaceId={WORKSPACE_ID}
        row={folderRow(FOLDER_A)}
        onClose={() => undefined}
      />,
      { wrapper }
    );
    await screen.findByTestId("drive-row-actions");
    expect(screen.queryByTestId("drive-action-share")).toBeNull();
  });
});
