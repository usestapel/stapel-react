/**
 * The viewing wave (stapel-docs 0.8.0), proved over the wire:
 *
 * 1. A viewable file opens IN PLACE — a photo in the lightbox (on the
 *    minted download URL; on the authorized content stream when the mint
 *    503s), audio/video as players — and an editable/opaque document keeps
 *    routing to the host's `onOpenDocument`, unchanged.
 * 2. Sibling photos are swipeable: the arrows step through the images the
 *    listing already had, no refetch.
 * 3. A zip opens as the ARCHIVE SHEET: the flat central-directory listing
 *    drawn as folders locally, the encrypted state as a lock banner, and
 *    the per-request password reaching the wire as the
 *    `X-Docs-Archive-Password` HEADER — never a query string.
 * 4. The row's Version history action mounts the docs pair's finished
 *    RevisionsModal — nothing re-implemented.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DriveScreen, ArchiveSheetPanel, entriesUnder } from "../src/default/index.js";
import type { ArchiveEntry } from "../src/index.js";
import { BASE, WORKSPACE_ID, harness, wire } from "./helpers.js";
import { DOC_A, DOC_B, FOLDER_A } from "./fixtures.js";
import type { DocDocument } from "@stapel/docs-react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DOC_IMG2: DocDocument = {
  ...DOC_A,
  id: "d-img2",
  title: "Loading dock.png",
  mime_type: "image/png",
};

const DOC_VIDEO: DocDocument = {
  ...DOC_A,
  id: "d-clip",
  title: "Walkthrough.mp4",
  mime_type: "video/mp4",
};

const DOC_ZIP: DocDocument = {
  ...DOC_A,
  id: "d-zip",
  title: "site-photos.zip",
  mime_type: "application/zip",
};

const EMPTY_TABS = {
  "/starred": { body: { folders: [], documents: [] } },
  "/recents": { body: [] },
  "/trash": { body: { folders: [], documents: [] } },
};

const LISTING = {
  entry_count: 4,
  total_uncompressed_bytes: 5000,
  archive_encrypted: false,
  entries: [
    { path: "readme.txt", size_bytes: 24, compressed_bytes: 20, is_dir: false, encrypted: false, mime_type: "text/plain", modified_at: null },
    { path: "img/", size_bytes: 0, compressed_bytes: 0, is_dir: true, encrypted: false, mime_type: "", modified_at: null },
    { path: "img/photo.png", size_bytes: 4000, compressed_bytes: 3900, is_dir: false, encrypted: false, mime_type: "image/png", modified_at: null },
    { path: "deep/nested/one.txt", size_bytes: 10, compressed_bytes: 8, is_dir: false, encrypted: false, mime_type: "text/plain", modified_at: null },
  ],
};

describe("opening a row picks the right surface", () => {
  it("an image row opens the lightbox on the minted URL; an opaque one still routes to the host", async () => {
    const stub = wire({
      "/folders": { body: [] },
      "/documents": { body: [DOC_A, DOC_B] },
      [`/documents/${DOC_A.id}`]: { body: DOC_A },
      [`/documents/${DOC_A.id}/download`]: {
        body: { url: "https://cdn.test/signed/warehouse.jpg" },
      },
      ...EMPTY_TABS,
    });
    const { wrapper } = harness(stub);
    const onOpenDocument = vi.fn();
    render(
      <DriveScreen workspaceId={WORKSPACE_ID} onOpenDocument={onOpenDocument} />,
      { wrapper }
    );
    fireEvent.click(await screen.findByTestId(`drive-row-${DOC_A.id}`));
    await waitFor(() => {
      expect(screen.getByTestId("drive-lightbox-image")).toBeDefined();
    });
    expect(
      screen.getByTestId("drive-lightbox-image").getAttribute("src")
    ).toBe("https://cdn.test/signed/warehouse.jpg");
    expect(onOpenDocument).not.toHaveBeenCalled();

    // The pdf row is NOT a viewer's: the host surface keeps it.
    fireEvent.click(screen.getByTestId(`drive-row-${DOC_B.id}`));
    expect(onOpenDocument).toHaveBeenCalledWith(DOC_B.id);
  });

  it("an unsignable-URL 503 falls back to the authorized content stream", async () => {
    const stub = wire({
      "/folders": { body: [] },
      "/documents": { body: [DOC_A] },
      [`/documents/${DOC_A.id}`]: { body: DOC_A },
      [`/documents/${DOC_A.id}/download`]: {
        status: 503,
        body: {
          localizable_error: "error.503.docs_download_url_unavailable",
          error: "no signed URLs here",
          params: {},
        },
      },
      ...EMPTY_TABS,
    });
    const { wrapper } = harness(stub);
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    fireEvent.click(await screen.findByTestId(`drive-row-${DOC_A.id}`));
    await waitFor(() => {
      expect(screen.getByTestId("drive-lightbox-image")).toBeDefined();
    });
    expect(
      screen.getByTestId("drive-lightbox-image").getAttribute("src")
    ).toBe(`${BASE.slice(0, -1)}/documents/${DOC_A.id}/content`);
  });

  it("a video row opens the player", async () => {
    const stub = wire({
      "/folders": { body: [] },
      "/documents": { body: [DOC_VIDEO] },
      [`/documents/${DOC_VIDEO.id}`]: { body: DOC_VIDEO },
      [`/documents/${DOC_VIDEO.id}/download`]: {
        body: { url: "https://cdn.test/signed/clip.mp4" },
      },
      ...EMPTY_TABS,
    });
    const { wrapper } = harness(stub);
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    fireEvent.click(await screen.findByTestId(`drive-row-${DOC_VIDEO.id}`));
    await waitFor(() => {
      expect(screen.getByTestId("drive-lightbox-video")).toBeDefined();
    });
    const video = screen.getByTestId<HTMLVideoElement>("drive-lightbox-video");
    expect(video.getAttribute("src")).toBe("https://cdn.test/signed/clip.mp4");
    expect(video.hasAttribute("controls")).toBe(true);
  });

  it("the arrows step through the listing's other photos without a refetch", async () => {
    const stub = wire({
      "/folders": { body: [] },
      "/documents": { body: [DOC_A, DOC_IMG2] },
      [`/documents/${DOC_A.id}`]: { body: DOC_A },
      [`/documents/${DOC_A.id}/download`]: {
        body: { url: "https://cdn.test/signed/warehouse.jpg" },
      },
      [`/documents/${DOC_IMG2.id}`]: { body: DOC_IMG2 },
      [`/documents/${DOC_IMG2.id}/download`]: {
        body: { url: "https://cdn.test/signed/dock.png" },
      },
      ...EMPTY_TABS,
    });
    const { wrapper } = harness(stub);
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    fireEvent.click(await screen.findByTestId(`drive-row-${DOC_A.id}`));
    await waitFor(() => {
      expect(screen.getByTestId("drive-lightbox-image")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("drive-lightbox-next"));
    await waitFor(() => {
      expect(
        screen.getByTestId("drive-lightbox-image").getAttribute("src")
      ).toBe("https://cdn.test/signed/dock.png");
    });
    // Stepping consumed the rows the listing already had: exactly one
    // /documents read went over the wire.
    const listingReads = stub.calls.filter((call) =>
      call.pathname.endsWith("/documents")
    );
    expect(listingReads).toHaveLength(1);
  });
});

describe("a zip opens as a compressed folder", () => {
  it("lists entries, draws implied directories, descends locally", async () => {
    const stub = wire({
      "/folders": { body: [] },
      "/documents": { body: [DOC_ZIP] },
      [`/documents/${DOC_ZIP.id}/archive`]: { body: LISTING },
      ...EMPTY_TABS,
    });
    const { wrapper } = harness(stub);
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    fireEvent.click(await screen.findByTestId(`drive-row-${DOC_ZIP.id}`));
    await waitFor(() => {
      expect(screen.getByTestId("drive-archive-body")).toBeDefined();
    });
    // Root rung: one file, and TWO directories — img/ (explicit) and deep/
    // (implied by a deeper path; zips are not required to carry dir rows).
    expect(document.querySelector('[data-drive-archive-entry="readme.txt"]')).toBeTruthy();
    expect(document.querySelector('[data-drive-archive-dir="img/"]')).toBeTruthy();
    expect(document.querySelector('[data-drive-archive-dir="deep/"]')).toBeTruthy();

    const img = document.querySelector('[data-drive-archive-dir="img/"]');
    if (!(img instanceof HTMLElement)) throw new Error("dir row missing");
    fireEvent.click(img);
    await waitFor(() => {
      expect(
        document.querySelector('[data-drive-archive-entry="img/photo.png"]')
      ).toBeTruthy();
    });
    // Descending was local: the archive listing went over the wire ONCE.
    expect(
      stub.calls.filter((call) => call.pathname.endsWith("/archive"))
    ).toHaveLength(1);
  });

  it("an encrypted archive shows the lock, and the password rides the header", async () => {
    const encrypted = {
      ...LISTING,
      archive_encrypted: true,
      entries: [
        { path: "secret.png", size_bytes: 9, compressed_bytes: 9, is_dir: false, encrypted: true, mime_type: "image/png", modified_at: null },
      ],
    };
    const stub = wire({
      [`/documents/${DOC_ZIP.id}/archive`]: { body: encrypted },
      [`/documents/${DOC_ZIP.id}/archive/entry`]: () =>
        new Response(new Blob([new Uint8Array([1, 2, 3])]), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    });
    const { wrapper } = harness(stub);
    render(
      <ArchiveSheetPanel
        documentId={DOC_ZIP.id}
        title={DOC_ZIP.title}
        onClose={() => undefined}
      />,
      { wrapper }
    );
    await waitFor(() => {
      expect(screen.getByTestId("drive-archive-lock")).toBeDefined();
    });
    expect(screen.getByTestId("drive-archive-locked-tag")).toBeDefined();

    fireEvent.change(screen.getByTestId("drive-archive-password"), {
      target: { value: "hunter2" },
    });
    const row = document.querySelector('[data-drive-archive-entry="secret.png"]');
    if (!(row instanceof HTMLElement)) throw new Error("entry row missing");
    fireEvent.click(row);
    await waitFor(() => {
      const entryCall = stub.calls.find((call) =>
        call.pathname.endsWith("/archive/entry")
      );
      expect(entryCall).toBeDefined();
      expect(entryCall?.headers["x-docs-archive-password"]).toBe("hunter2");
      expect(entryCall?.search).not.toContain("hunter2");
    });
  });

  it("a named refusal renders as its own sentence, not a generic failure", async () => {
    const stub = wire({
      [`/documents/${DOC_ZIP.id}/archive`]: {
        status: 413,
        body: {
          localizable_error: "error.413.docs_archive_too_many_entries",
          error: "The archive holds too many entries to browse",
          params: { limit: 10000 },
        },
      },
    });
    const { wrapper } = harness(stub);
    render(
      <ArchiveSheetPanel documentId={DOC_ZIP.id} onClose={() => undefined} />,
      { wrapper }
    );
    await waitFor(() => {
      expect(
        screen.getByText("The archive holds too many entries to browse")
      ).toBeDefined();
    });
  });
});

describe("version history from the row", () => {
  it("mounts the docs pair's RevisionsModal", async () => {
    const stub = wire({
      "/folders": { body: [FOLDER_A] },
      "/documents": { body: [DOC_B] },
      [`/documents/${DOC_B.id}`]: { body: DOC_B },
      [`/documents/${DOC_B.id}/revisions`]: { body: [] },
      ...EMPTY_TABS,
    });
    const { wrapper } = harness(stub);
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    fireEvent.click(
      await screen.findByTestId(`drive-actions-${DOC_B.id}`)
    );
    fireEvent.click(await screen.findByTestId("drive-action-history"));
    await waitFor(() => {
      expect(screen.getByTestId("docs-revisions-modal")).toBeDefined();
    });
  });
});

describe("entriesUnder — the local folder illusion", () => {
  it("separates one rung's files and (explicit or implied) directories", () => {
    const entries = LISTING.entries as unknown as readonly ArchiveEntry[];
    const root = entriesUnder(entries, "");
    expect(root.files.map((file) => file.path)).toEqual(["readme.txt"]);
    expect(root.dirs).toEqual(["deep/", "img/"]);
    const deep = entriesUnder(entries, "deep/");
    expect(deep.dirs).toEqual(["nested/"]);
    expect(deep.files).toEqual([]);
    const nested = entriesUnder(entries, "deep/nested/");
    expect(nested.files.map((file) => file.path)).toEqual(["deep/nested/one.txt"]);
  });
});
