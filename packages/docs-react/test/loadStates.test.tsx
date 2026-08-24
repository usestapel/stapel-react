/**
 * The absence of a result must never be spelled like a result.
 *
 * On 2026-08-09 app.ironmemo.com's list endpoint answered 404 for hours while
 * the screen said "you have nothing" and greyed the action out with no
 * reason on it. These tests hold the three answers apart on this pair's
 * surfaces, at the wire (msw), where the outage actually lives:
 *
 *   loading  → no empty copy, no error;
 *   empty    → the empty copy, and ONLY for a read that succeeded;
 *   failed   → the error, and NEVER the empty copy;
 *   and a control switched off by a failed read says so, in words.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { registerDocsI18n } from "../src/i18n/keys.js";
import { DocSurface, FileManager, TrashPane } from "../src/default/index.js";

const BASE = "https://docs.stapel.test/docs/api/v1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function wrap(runtime: DocsRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerDocsI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <DocsProvider runtime={runtime}>{children}</DocsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** A request that never settles — the honest shape of "still loading". */
function pending(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

describe("document list — loading / empty / failed are three different screens", () => {
  it("loading: says nothing about emptiness and shows no error", async () => {
    server.use(
      http.get(`${BASE}/folders`, () => HttpResponse.json([])),
      http.get(`${BASE}/documents`, pending)
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));

    await waitFor(() =>
      expect(screen.getByTestId("docs-document-list-pane")).toBeDefined()
    );
    expect(screen.queryByText("No documents yet.")).toBeNull();
    expect(screen.queryByTestId("docs-list-failed")).toBeNull();
  });

  it("empty: the workspace really has no documents — and no error beside it", async () => {
    server.use(
      http.get(`${BASE}/folders`, () => HttpResponse.json([])),
      http.get(`${BASE}/documents`, () => HttpResponse.json([]))
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));

    await waitFor(() =>
      expect(screen.getByText("No documents yet.")).toBeDefined()
    );
    expect(screen.queryByTestId("docs-list-failed")).toBeNull();
  });

  it("failed: the error is shown and the empty copy is NEVER rendered (the 2026-08-09 lie)", async () => {
    server.use(
      http.get(`${BASE}/folders`, () => HttpResponse.json([])),
      http.get(`${BASE}/documents`, () => new HttpResponse(null, { status: 404 }))
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));

    await waitFor(() =>
      expect(screen.getByTestId("docs-list-failed")).toBeDefined()
    );
    // A 404 on the list must not read as "you have no documents".
    expect(screen.queryByText("No documents yet.")).toBeNull();
  });

  it("failed folder read: the tree says so instead of claiming there are no folders", async () => {
    server.use(
      http.get(`${BASE}/folders`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE}/documents`, () => HttpResponse.json([]))
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));

    await waitFor(() =>
      expect(screen.getByTestId("docs-tree-failed")).toBeDefined()
    );
    expect(screen.queryByText("No folders yet.")).toBeNull();
  });
});

describe("'Empty trash' — a switched-off control states its reason", () => {
  function emptyTrashButton(): HTMLButtonElement {
    const button = screen.getByTestId("docs-trash-empty");
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("empty-trash button not rendered");
    }
    return button;
  }

  /** The whole gated wrapper's copy: the reason sentence AND the technical
   * detail beside it, which `GatedControl` renders as two nodes. */
  function emptyTrashGateText(): string {
    return screen.getByTestId("docs-trash-empty-gate").textContent ?? "";
  }

  it("failed read: disabled WITH the load-failure sentence, not the empty-trash one", async () => {
    server.use(
      http.get(`${BASE}/trash`, () => new HttpResponse(null, { status: 404 }))
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TrashPane workspaceId="ws-1" />));

    await waitFor(() =>
      expect(screen.getByTestId("docs-trash-failed")).toBeDefined()
    );
    expect(emptyTrashButton().disabled).toBe(true);
    const reason = emptyTrashGateText();
    expect(reason).toContain("We could not load what this needs.");
    // The technical detail support quotes, beside the sentence — not inside it.
    expect(reason).toContain("404");
    // And never the sentence that blames an empty trash for an outage.
    expect(screen.queryByText("Trash is empty.")).toBeNull();
  });

  it("genuinely empty: disabled with the EMPTY reason", async () => {
    server.use(
      http.get(`${BASE}/trash`, () =>
        HttpResponse.json({ folders: [], documents: [] })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TrashPane workspaceId="ws-1" />));

    await waitFor(() => expect(screen.getByText("Trash is empty.")).toBeDefined());
    expect(emptyTrashButton().disabled).toBe(true);
    expect(emptyTrashGateText()).toContain(
      "There is nothing in the trash to delete."
    );
  });

  it("loaded and non-empty: the control is live and carries no reason", async () => {
    server.use(
      http.get(`${BASE}/trash`, () =>
        HttpResponse.json({
          folders: [],
          documents: [
            {
              id: "d-9",
              workspace_id: "ws-1",
              folder_id: null,
              type: "note",
              title: "Deleted draft",
              head_seq: 1,
              snapshot_seq: 1,
              size_bytes: 4,
              mime_type: "text/plain",
              metadata: {},
              editor_hint: "text",
              collab: "snapshot",
              diffable: true,
              created_at: "2026-08-01T09:00:00Z",
              updated_at: "2026-08-02T09:00:00Z",
            },
          ],
        })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TrashPane workspaceId="ws-1" />));

    await waitFor(() => expect(screen.getByText("Deleted draft")).toBeDefined());
    expect(emptyTrashButton().disabled).toBe(false);
    expect(
      screen
        .getByTestId("docs-trash-empty-gate")
        .querySelector("[data-stapel-gated-reason]")
    ).toBeNull();
  });
});

describe("FileCard download — a URL that could not be minted says so", () => {
  const FILE_DOC = {
    id: "d-3",
    workspace_id: "ws-1",
    folder_id: null,
    type: "file",
    title: "Contract.pdf",
    head_seq: 1,
    snapshot_seq: 1,
    size_bytes: 12,
    mime_type: "application/pdf",
    metadata: {},
    editor_hint: "",
    collab: "snapshot",
    diffable: false,
    created_at: "2026-08-01T09:00:00Z",
    updated_at: "2026-08-02T09:00:00Z",
  };

  it("failed URL mint: the button is off, the reason is on screen, the title survives", async () => {
    server.use(
      http.get(`${BASE}/documents/d-3`, () => HttpResponse.json(FILE_DOC)),
      http.get(
        `${BASE}/documents/d-3/download`,
        () => new HttpResponse(null, { status: 500 })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <DocSurface documentId="d-3" />));

    await waitFor(() =>
      expect(screen.getByTestId("docs-file-download-gate")).toBeDefined()
    );
    // The document itself loaded fine — only the download is blocked.
    expect(screen.getByText("Contract.pdf")).toBeDefined();
    const button = screen.getByTestId("docs-file-download");
    expect(button instanceof HTMLButtonElement && button.disabled).toBe(true);
    expect(
      screen.getByTestId("docs-file-download-gate").textContent
    ).toContain("We could not load what this needs.");
  });

  it("minted URL: the button is live and carries no reason", async () => {
    server.use(
      http.get(`${BASE}/documents/d-3`, () => HttpResponse.json(FILE_DOC)),
      http.get(`${BASE}/documents/d-3/download`, () =>
        HttpResponse.json({ url: "https://cdn.stapel.test/signed/d-3" })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <DocSurface documentId="d-3" />));

    const button = await waitFor(() => {
      const el = screen.getByTestId("docs-file-download");
      if (!(el instanceof HTMLButtonElement)) throw new Error("not mounted");
      return el;
    });
    expect(button.disabled).toBe(false);
    expect(
      screen
        .getByTestId("docs-file-download-gate")
        .querySelector("[data-stapel-gated-reason]")
    ).toBeNull();
  });
});
