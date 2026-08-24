/**
 * The `/default` skin proof (§54 form, owner directive: docs get good
 * default skins — file manager, context menus, revision modal, editors):
 *
 * 1. SELF-THEMING with computed colors (tracker #26): the skin's OWN
 *    `DocsSkinTheme` stamps the mode's text/surface colors — asserted via
 *    `getComputedStyle`, and a test FAILS if text color equals background.
 * 2. Context menus wired 1:1 to the wire: rename = PATCH, move = PATCH,
 *    trash = DELETE, restore = POST /restore, download = the opaque URL.
 * 3. RevisionsModal: list + preview (`GET …/:rev/content`) + rollback
 *    (`POST …/:rev/restore`).
 * 4. DocSurface + default editors on the If-Match snapshot path.
 * 5. REPLACEABLE WITHOUT FORKING: the skin slot registry swaps a pane; an
 *    explicit `registerDocEditor` wins over the skin's default editor.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { colors } from "@stapel/tokens";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { registerDocsI18n } from "../src/i18n/keys.js";
import { registerDocEditor, unregisterDocEditor } from "../src/editors/registry.js";
import {
  DocSurface,
  FileManager,
  RevisionsModal,
  registerDocsSkinComponent,
  unregisterDocsSkinComponent,
} from "../src/default/index.js";
import type { DocEditorAdapterProps } from "../src/editors/registry.js";

const BASE = "https://docs.stapel.test/docs/api/v1";

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
  collab: "snapshot",
  diffable: true,
  created_at: "2026-08-01T09:00:00Z",
  updated_at: "2026-08-02T09:00:00Z",
};
/** Unfiled document — what the root view of the file manager shows. */
const DOC_ROOT = {
  ...DOCUMENT,
  id: "d-2",
  folder_id: null,
  title: "Roadmap",
  editor_hint: "text",
  mime_type: "text/plain",
};

const REVISION = {
  id: "rev-1",
  document_id: "d-1",
  kind: "named",
  name: "before rewrite",
  seq: 3,
  size_bytes: 11,
  created_by: "u-1",
  created_at: "2026-08-02T08:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup(); // unmount between renders: isolates DOM queries + clears antd timers
  server.resetHandlers();
  vi.restoreAllMocks();
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

/** The list/tree reads every FileManager mount performs. */
function useManagerHandlers(): void {
  server.use(
    http.get(`${BASE}/folders`, () =>
      HttpResponse.json([FOLDER_ROOT, FOLDER_CHILD])
    ),
    http.get(`${BASE}/documents`, () =>
      HttpResponse.json([DOC_ROOT, DOCUMENT])
    )
  );
}

/** `#rrggbb` / `rgb(r, g, b)` → one canonical `r,g,b` string, so computed
 * styles compare regardless of jsdom's serialization. */
function toRgbTriplet(value: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex?.[1] !== undefined) {
    const n = parseInt(hex[1], 16);
    return [n >> 16, (n >> 8) & 0xff, n & 0xff].join(",");
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value.trim());
  if (rgb) return [rgb[1], rgb[2], rgb[3]].join(",");
  throw new Error(`unparseable color: ${value}`);
}

function skinRootComputed(): { color: string; background: string } {
  const root = document.querySelector("[data-stapel-skin-root]");
  if (!(root instanceof HTMLElement)) throw new Error("skin root not rendered");
  const computed = getComputedStyle(root);
  return {
    color: toRgbTriplet(computed.color),
    background: toRgbTriplet(computed.backgroundColor),
  };
}

describe("SkinTheme — self-theming with computed colors (tracker #26)", () => {
  it("light mode: text and background come from @stapel/tokens and are NOT equal", async () => {
    useManagerHandlers();
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" mode="light" />));
    await waitFor(() => expect(screen.getByText("Roadmap")).toBeDefined());

    const { color, background } = skinRootComputed();
    expect(color).toBe(toRgbTriplet(colors.text.light));
    expect(background).toBe(toRgbTriplet(colors["surface-raised"].light));
    // The 1.00:1 regression gate: text on its own background must differ.
    expect(color).not.toBe(background);
  });

  it("dark mode: the SAME surface serves the dark palette — no light/dark blend", async () => {
    useManagerHandlers();
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" mode="dark" />));
    await waitFor(() => expect(screen.getByText("Roadmap")).toBeDefined());

    const { color, background } = skinRootComputed();
    expect(color).toBe(toRgbTriplet(colors.text.dark));
    expect(background).toBe(toRgbTriplet(colors["surface-raised"].dark));
    expect(color).not.toBe(background);
    // And the two modes are actually different palettes.
    expect(color).not.toBe(toRgbTriplet(colors.text.light));
  });

  it("defaults to the host document's data-theme (resolveThemeMode contract)", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    try {
      useManagerHandlers();
      const runtime = createDocsRuntime({ baseUrl: BASE });
      render(wrap(runtime, <FileManager workspaceId="ws-1" />));
      await waitFor(() => expect(screen.getByText("Roadmap")).toBeDefined());
      const { color, background } = skinRootComputed();
      expect(color).toBe(toRgbTriplet(colors.text.dark));
      expect(color).not.toBe(background);
    } finally {
      document.documentElement.removeAttribute("data-theme");
    }
  });
});

describe("<FileManager/> — the composed default surface", () => {
  it("renders tree + breadcrumbs + ROOT-scoped list (unfiled documents only)", async () => {
    useManagerHandlers();
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));

    await waitFor(() => expect(screen.getByText("Roadmap")).toBeDefined());
    // Folders in the tree.
    expect(screen.getByText("Specs")).toBeDefined();
    expect(screen.getByText("Q3")).toBeDefined();
    // d-1 lives in f-root — the ROOT list view must not show it.
    expect(screen.queryByText("Design notes")).toBeNull();
    // Breadcrumb root.
    expect(screen.getByText("All documents")).toBeDefined();
  });

  it("context menu on a document: Rename → PATCH /documents/:id {title}", async () => {
    useManagerHandlers();
    let patched: unknown = null;
    server.use(
      http.patch(`${BASE}/documents/d-2`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...DOC_ROOT, title: "Roadmap 2027" });
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));
    await waitFor(() => expect(screen.getByText("Roadmap")).toBeDefined());

    fireEvent.contextMenu(screen.getByText("Roadmap"));
    fireEvent.click(await screen.findByText("Rename"));

    const input = await screen.findByTestId("docs-name-input");
    fireEvent.change(input, { target: { value: "Roadmap 2027" } });
    fireEvent.click(screen.getByText("OK"));

    await waitFor(() => expect(patched).toEqual({ title: "Roadmap 2027" }));
  });

  it("context menu on a document: Move to… → PATCH /documents/:id {folder_id}", async () => {
    useManagerHandlers();
    let patched: unknown = null;
    server.use(
      http.patch(`${BASE}/documents/d-2`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...DOC_ROOT, folder_id: "f-child" });
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));
    await waitFor(() => expect(screen.getByText("Roadmap")).toBeDefined());

    fireEvent.contextMenu(screen.getByText("Roadmap"));
    fireEvent.click(await screen.findByText("Move to…"));

    // Open the destination Select (antd v6: the shell is the combobox
    // input inside .ant-select-content) and pick the child folder.
    const combobox = await screen.findByRole("combobox");
    fireEvent.mouseDown(combobox);
    const option = await screen.findByTitle("Q3");
    fireEvent.click(option);
    fireEvent.click(screen.getByText("OK"));

    await waitFor(() => expect(patched).toEqual({ folder_id: "f-child" }));
  });

  it("context menu on a document: Download resolves the opaque URL and opens it", async () => {
    useManagerHandlers();
    server.use(
      http.get(`${BASE}/documents/d-2/download`, () =>
        HttpResponse.json({ url: "https://cdn.stapel.test/signed/d-2" })
      )
    );
    const opened = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));
    await waitFor(() => expect(screen.getByText("Roadmap")).toBeDefined());

    fireEvent.contextMenu(screen.getByText("Roadmap"));
    fireEvent.click(await screen.findByText("Download"));

    await waitFor(() =>
      expect(opened).toHaveBeenCalledWith(
        "https://cdn.stapel.test/signed/d-2",
        "_blank",
        "noopener"
      )
    );
  });

  it("context menu on a folder: Move to trash → DELETE /folders/:id", async () => {
    useManagerHandlers();
    let deleted = false;
    server.use(
      http.delete(`${BASE}/folders/f-child`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));
    await waitFor(() => expect(screen.getByText("Q3")).toBeDefined());

    fireEvent.contextMenu(screen.getByText("Q3"));
    fireEvent.click(await screen.findByText("Move to trash"));

    await waitFor(() => expect(deleted).toBe(true));
  });

  it("trash view: restore a folder → POST /folders/:id/restore (the trash's REAL {folders, documents} shape)", async () => {
    useManagerHandlers();
    let restored = false;
    server.use(
      http.get(`${BASE}/trash`, () =>
        HttpResponse.json({ folders: [FOLDER_CHILD], documents: [DOCUMENT] })
      ),
      http.post(`${BASE}/folders/f-child/restore`, () => {
        restored = true;
        return HttpResponse.json(FOLDER_CHILD);
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileManager workspaceId="ws-1" />));
    await waitFor(() => expect(screen.getByText("Roadmap")).toBeDefined());

    fireEvent.click(screen.getByText("Trash"));
    await waitFor(() =>
      expect(screen.getByTestId("docs-trash-pane")).toBeDefined()
    );
    await waitFor(() => expect(screen.getByText("Design notes")).toBeDefined());

    fireEvent.contextMenu(screen.getByText("Q3"));
    fireEvent.click(await screen.findByText("Restore"));

    await waitFor(() => expect(restored).toBe(true));
  });

  it("slot registry: a registered listPane REPLACES the builtin without a fork", async () => {
    useManagerHandlers();
    function ProbePane(): ReactElement {
      return <div data-testid="probe-list-pane" />;
    }
    try {
      registerDocsSkinComponent("fileManager.listPane", ProbePane);
      const runtime = createDocsRuntime({ baseUrl: BASE });
      render(wrap(runtime, <FileManager workspaceId="ws-1" />));
      await waitFor(() =>
        expect(screen.getByTestId("probe-list-pane")).toBeDefined()
      );
      expect(screen.queryByTestId("docs-document-list-pane")).toBeNull();
    } finally {
      unregisterDocsSkinComponent("fileManager.listPane");
    }
  });
});

describe("<RevisionsModal/> — history list, preview, rollback", () => {
  function useRevisionHandlers(): void {
    server.use(
      http.get(`${BASE}/documents/d-1`, () => HttpResponse.json(DOCUMENT)),
      http.get(`${BASE}/documents/d-1/revisions`, () =>
        HttpResponse.json([REVISION])
      )
    );
  }

  it("lists revisions and previews one inline (GET …/:rev/content)", async () => {
    useRevisionHandlers();
    server.use(
      http.get(`${BASE}/documents/d-1/revisions/rev-1/content`, () =>
        HttpResponse.text("# old draft")
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RevisionsModal documentId="d-1" open onClose={() => {}} />
      )
    );

    await waitFor(() => expect(screen.getByText("before rewrite")).toBeDefined());
    fireEvent.click(screen.getByText("before rewrite"));

    const preview = await screen.findByTestId("docs-revision-preview");
    expect(preview.textContent).toBe("# old draft");
  });

  it("rollback posts POST …/:rev/restore behind the confirm", async () => {
    useRevisionHandlers();
    let rolledBack = false;
    server.use(
      http.post(`${BASE}/documents/d-1/revisions/rev-1/restore`, () => {
        rolledBack = true;
        return HttpResponse.json({ ...DOCUMENT, head_seq: 5 });
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RevisionsModal documentId="d-1" open onClose={() => {}} />
      )
    );

    await waitFor(() => expect(screen.getByText("before rewrite")).toBeDefined());
    fireEvent.click(screen.getByTestId("docs-revision-rollback"));
    // SkinConfirm's affirmative names the action it takes.
    fireEvent.click(await screen.findByTestId("stapel-confirm-ok"));

    await waitFor(() => expect(rolledBack).toBe(true));
  });
});

describe("<DocSurface/> + default editors — the If-Match snapshot path", () => {
  function useEditorHandlers(state: { text: string; seq: number }): {
    seenIfMatch: () => string | null;
    seenBody: () => string;
  } {
    let ifMatch: string | null = null;
    let body = "";
    server.use(
      http.get(`${BASE}/documents/d-1`, () => HttpResponse.json(DOCUMENT)),
      http.get(`${BASE}/documents/d-1/content`, () =>
        HttpResponse.text(state.text, {
          headers: { "X-Docs-Head-Seq": String(state.seq) },
        })
      ),
      http.put(`${BASE}/documents/d-1/content`, async ({ request }) => {
        ifMatch = request.headers.get("If-Match");
        body = await request.text();
        state.text = body;
        state.seq += 1;
        return HttpResponse.json({
          head_seq: state.seq,
          revision_id: "rev-9",
        });
      })
    );
    return { seenIfMatch: () => ifMatch, seenBody: () => body };
  }

  it("markdown default editor: loads, edits, saves at the loaded head", async () => {
    const wire = useEditorHandlers({ text: "# hello", seq: 4 });
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <DocSurface documentId="d-1" />));

    const textarea = await waitFor(() => {
      const el = document.querySelector('[data-doc-editor="markdown"]');
      if (!(el instanceof HTMLTextAreaElement)) throw new Error("not mounted");
      return el;
    });
    expect(textarea.value).toBe("# hello");

    fireEvent.change(textarea, { target: { value: "# hello world" } });
    expect(screen.getByTestId("docs-editor-dirty")).toBeDefined();

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(wire.seenBody()).toBe("# hello world"));
    expect(wire.seenIfMatch()).toBe("4");
    // Saved state: the dirty tag clears.
    await waitFor(() =>
      expect(screen.queryByTestId("docs-editor-dirty")).toBeNull()
    );
  });

  it("an explicit registerDocEditor registration WINS over the skin's default (no shadowing the seam)", async () => {
    useEditorHandlers({ text: "# hello", seq: 4 });
    function CustomMarkdown(props: DocEditorAdapterProps): ReactElement {
      return <div data-testid="custom-markdown">{props.bag.value}</div>;
    }
    try {
      registerDocEditor("markdown", CustomMarkdown);
      const runtime = createDocsRuntime({ baseUrl: BASE });
      render(wrap(runtime, <DocSurface documentId="d-1" />));
      await waitFor(() =>
        expect(screen.getByTestId("custom-markdown")).toBeDefined()
      );
      expect(document.querySelector('[data-doc-editor="markdown"]')).toBeNull();
    } finally {
      unregisterDocEditor("markdown");
    }
  });

  it("download-only (editor_hint '') renders the FileCard fallback", async () => {
    const FILE_DOC = {
      ...DOCUMENT,
      id: "d-3",
      title: "Contract.pdf",
      editor_hint: "",
      mime_type: "application/pdf",
    };
    server.use(
      http.get(`${BASE}/documents/d-3`, () => HttpResponse.json(FILE_DOC)),
      http.get(`${BASE}/documents/d-3/download`, () =>
        HttpResponse.json({ url: "https://cdn.stapel.test/signed/d-3" })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <DocSurface documentId="d-3" />));

    await waitFor(() => expect(screen.getByTestId("docs-file-card")).toBeDefined());
    expect(screen.getByText("Contract.pdf")).toBeDefined();
    // The opaque URL resolves async — the download affordance appears then.
    expect(await screen.findByText("Download")).toBeDefined();
  });
});
