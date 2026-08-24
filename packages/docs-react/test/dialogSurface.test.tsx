/**
 * The default skin's dialogs, on the two surfaces the design system allows —
 * plus the three defects the surface conversion sat on top of.
 *
 * Owner ruling (2026-08-24): on a phone every modal is a BOTTOM SHEET; modals
 * are tablet/desktop only. The rule lives once, in `@stapel/tokens-antd/skin`'s
 * `<SkinDialog>`, which stamps the surface it chose on the body wrapper —
 * so this pair proves it INHERITS the rule instead of asserting it in prose.
 * The viewport is set before `render()` because the surface is read on the
 * very first client render (`useSyncExternalStore`), not in an effect.
 *
 * The defects, all three fixed here and pinned below:
 *  1. rollback was offered on the revision the document is already at — a
 *     restore that writes a new, byte-identical head;
 *  2. one `isRestoring` drove EVERY row's spinner, so rolling back one
 *     revision made the whole history look like it was restoring;
 *  3. the move dialog's confirm was live on the folder the document is
 *     already in — a PATCH the backend takes and that changes nothing.
 *
 * Wire reads are intercepted at the HTTP layer (MSW), never by mocking the
 * api module: nothing that crosses the network boundary is hand-shaped here.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { registerDocsI18n } from "../src/i18n/keys.js";
import { FileManager, RevisionsModal } from "../src/default/index.js";

const BASE = "https://docs.stapel.test/docs/api/v1";

/** jsdom's own window — a desktop, which is why a blanket-`false` matchMedia
 * stub was a lie rather than a neutral default. */
const DESKTOP_WIDTH = 1024;
/** Narrower than the `tablet` breakpoint the skin queries (768px). */
const PHONE_WIDTH = 390;

const FOLDER_ROOT = {
  id: "f-root",
  workspace_id: "ws-1",
  parent_id: null,
  name: "Specs",
  created_at: "2026-08-01T09:00:00Z",
  updated_at: "2026-08-01T09:00:00Z",
};
const FOLDER_CHILD = { ...FOLDER_ROOT, id: "f-child", parent_id: "f-root", name: "Q3" };

const DOCUMENT = {
  id: "d-1",
  workspace_id: "ws-1",
  folder_id: "f-root",
  type: "note",
  title: "Design notes",
  head_seq: 4,
  snapshot_seq: 4,
  size_bytes: 11,
  mime_type: "text/markdown",
  metadata: {},
  editor_hint: "markdown",
  collab: false,
  diffable: true,
  created_at: "2026-08-01T09:00:00Z",
  updated_at: "2026-08-02T09:00:00Z",
};
/** Unfiled document — what the root view of the file manager shows. Its
 * current parent is the workspace root, which is what the move dialog opens
 * preselected on. */
const DOC_ROOT = {
  ...DOCUMENT,
  id: "d-2",
  folder_id: null,
  title: "Roadmap",
  editor_hint: "text",
  mime_type: "text/plain",
};

/** `rev-head` snapshots seq 4 — the document's `head_seq`, i.e. the content
 * on screen right now. The other two are real history. */
const REV_HEAD = {
  id: "rev-head",
  name: "current",
  seq: 4,
  author_id: "u-1",
  created_at: "2026-08-02T10:00:00Z",
};
const REV_MID = { ...REV_HEAD, id: "rev-mid", name: "before rewrite", seq: 3 };
const REV_OLD = { ...REV_HEAD, id: "rev-old", name: "first draft", seq: 2 };

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  setViewport(DESKTOP_WIDTH);
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  setViewport(DESKTOP_WIDTH);
});
afterAll(() => server.close());

/** The viewport the skin's media query reads. Set BEFORE `render()`. */
function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

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

/** The surface `<SkinDialog>` chose for the dialog `node` lives in. */
function surfaceAround(node: HTMLElement): string | null {
  const wrapper = node.closest("[data-stapel-dialog-surface]");
  if (!(wrapper instanceof HTMLElement)) throw new Error("no SkinDialog wrapper");
  return wrapper.getAttribute("data-stapel-dialog-surface");
}

/** The list/tree reads every FileManager mount performs. */
function serveManagerReads(): void {
  server.use(
    http.get(`${BASE}/folders`, () => HttpResponse.json([FOLDER_ROOT, FOLDER_CHILD])),
    http.get(`${BASE}/documents`, () => HttpResponse.json([DOC_ROOT, DOCUMENT]))
  );
}

/** The head read + the revision list `<RevisionsModal/>` mounts on. */
function serveRevisionReads(): void {
  server.use(
    http.get(`${BASE}/documents/d-1`, () => HttpResponse.json(DOCUMENT)),
    http.get(`${BASE}/documents/d-1/revisions`, () =>
      HttpResponse.json([REV_HEAD, REV_MID, REV_OLD])
    ),
    // Clicking a row selects it, and a selected text revision previews.
    http.get(`${BASE}/documents/d-1/revisions/:revisionId/content`, () =>
      HttpResponse.text("# snapshot")
    )
  );
}

/** Open the file manager and its document context menu on "Roadmap". */
async function openDocumentMenu(): Promise<void> {
  serveManagerReads();
  const runtime = createDocsRuntime({ baseUrl: BASE });
  render(wrap(runtime, <FileManager workspaceId="ws-1" />));
  await waitFor(() => expect(screen.getByText("Roadmap")).toBeDefined());
  fireEvent.contextMenu(screen.getByText("Roadmap"));
}

/** The rollback button of one revision row. */
function rollbackButton(revisionId: string): HTMLButtonElement {
  const row = document.querySelector(`[data-docs-revision="${revisionId}"]`);
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${revisionId}`);
  const button = within(row).getByRole("button");
  if (!(button instanceof HTMLButtonElement)) throw new Error("not a button");
  return button;
}

describe("every default-skin dialog is a bottom sheet on a phone", () => {
  it("<RevisionsModal/>: sheet at 390, modal at 1024", async () => {
    serveRevisionReads();
    setViewport(PHONE_WIDTH);
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <RevisionsModal documentId="d-1" open onClose={() => {}} />));
    expect(surfaceAround(await screen.findByTestId("docs-revisions-modal"))).toBe("sheet");

    cleanup();
    setViewport(DESKTOP_WIDTH);
    render(wrap(runtime, <RevisionsModal documentId="d-1" open onClose={() => {}} />));
    expect(surfaceAround(await screen.findByTestId("docs-revisions-modal"))).toBe("modal");
  });

  it("<NameDialog/> (rename): sheet at 390, modal at 1024", async () => {
    setViewport(PHONE_WIDTH);
    await openDocumentMenu();
    fireEvent.click(await screen.findByText("Rename"));
    expect(surfaceAround(await screen.findByTestId("docs-name-input"))).toBe("sheet");

    cleanup();
    setViewport(DESKTOP_WIDTH);
    await openDocumentMenu();
    fireEvent.click(await screen.findByText("Rename"));
    expect(surfaceAround(await screen.findByTestId("docs-name-input"))).toBe("modal");
  });

  it("<MoveDialog/>: sheet at 390, modal at 1024", async () => {
    setViewport(PHONE_WIDTH);
    await openDocumentMenu();
    fireEvent.click(await screen.findByText("Move to…"));
    expect(surfaceAround(await screen.findByRole("combobox"))).toBe("sheet");

    cleanup();
    setViewport(DESKTOP_WIDTH);
    await openDocumentMenu();
    fireEvent.click(await screen.findByText("Move to…"));
    expect(surfaceAround(await screen.findByRole("combobox"))).toBe("modal");
  });
});

describe("<RevisionsModal/> — rollback is per-revision, and not offered on the head", () => {
  it("the revision the document is already at cannot be rolled back, and says why", async () => {
    serveRevisionReads();
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <RevisionsModal documentId="d-1" open onClose={() => {}} />));

    await waitFor(() => expect(screen.getByText("first draft")).toBeDefined());
    // The head read decides which row is the current one — wait for it.
    await waitFor(() => expect(rollbackButton("rev-head").disabled).toBe(true));
    // Off with the reason ON SCREEN: a disabled control gets no pointer
    // events, so a tooltip would be a reason nobody can read.
    expect(screen.getByTestId("docs-revision-rollback-blocked").textContent).toBe(
      "This is the document's current version."
    );
    // …and real history is still rollback-able.
    expect(rollbackButton("rev-mid").disabled).toBe(false);
    expect(rollbackButton("rev-old").disabled).toBe(false);
  });

  it("one rollback spins ONLY its own row's button", async () => {
    serveRevisionReads();
    server.use(
      http.post(`${BASE}/documents/d-1/revisions/rev-mid/restore`, async () => {
        // Held in flight so the pending state can be observed at all.
        await delay(200);
        return HttpResponse.json({ ...DOCUMENT, head_seq: 5 });
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <RevisionsModal documentId="d-1" open onClose={() => {}} />));
    await waitFor(() => expect(screen.getByText("first draft")).toBeDefined());

    fireEvent.click(rollbackButton("rev-mid"));
    fireEvent.click(await screen.findByText("OK"));

    await waitFor(() =>
      expect(rollbackButton("rev-mid").className).toContain("ant-btn-loading")
    );
    expect(rollbackButton("rev-old").className).not.toContain("ant-btn-loading");
    expect(rollbackButton("rev-head").className).not.toContain("ant-btn-loading");
  });
});

describe("<MoveDialog/> — the folder it is already in is not a destination", () => {
  it("confirm is off on the current parent and on again once a real move is picked", async () => {
    await openDocumentMenu();
    fireEvent.click(await screen.findByText("Move to…"));

    const combobox = await screen.findByRole("combobox");
    // Opens preselected on the document's current parent (the workspace
    // root, for an unfiled document) — "move it where it already is".
    expect(screen.getByText("OK").closest("button")?.disabled).toBe(true);

    fireEvent.mouseDown(combobox);
    fireEvent.click(await screen.findByTitle("Q3"));

    await waitFor(() =>
      expect(screen.getByText("OK").closest("button")?.disabled).toBe(false)
    );
  });
});
