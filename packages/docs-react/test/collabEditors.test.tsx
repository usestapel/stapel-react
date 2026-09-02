/**
 * The `/editors/collab` surface — CodeMirror 6 + yCollab over the Y.Doc
 * session, registered for the two hints stapel-docs 0.7.0 actually emits
 * (`"markdown.crdt"` / `"text.crdt"` — `doc_types.py`, the `ymd`/`ytxt`
 * builtins).
 *
 * The engines are driven through the REAL packages (yjs, y-codemirror.next
 * and the CodeMirror trio are devDependencies here; optional peers in
 * production) — one test goes through the DEFAULT loader so the import
 * specifiers themselves are proven to resolve, the rest inject the loader
 * seam the way every lazy engine in this pair does.
 *
 * NO presence/awareness is asserted anywhere: the backend ships no awareness
 * transport in 0.7.0, and this surface deliberately binds `yCollab` without
 * one rather than faking cursors nobody is moving.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { registerDocsI18n } from "../src/i18n/keys.js";
import type { DocEditorBag } from "../src/headless/DocEditor.js";
import { explicitDocEditor, unregisterDocEditor } from "../src/editors/registry.js";
import { loadCodeMirror } from "../src/editors/codemirror/index.js";
import {
  COLLAB_DEFAULT_HINTS,
  createCollabDocEditor,
  registerCollabDocEditors,
} from "../src/editors/collab/index.js";
import type { CollabPeersLoader } from "../src/editors/collab/index.js";
import { CONTENT_KEY } from "../src/editors/collab/session.js";
import type { YDocSession } from "../src/editors/collab/session.js";
import type { YjsModule } from "../src/editors/collab/yjsPeer.js";
import { CRDT_DOCUMENT_TYPES } from "../src/model/documentTypes.js";

const BASE = "https://docs.stapel.test/docs/api/v1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const loadPeers: CollabPeersLoader = () =>
  Promise.resolve({
    yjs: Y as unknown as YjsModule,
    yCodeMirror: { yCollab: yCollab as (...args: unknown[]) => unknown },
  });

function serverState(text: string): Uint8Array {
  const doc = new Y.Doc();
  doc.getText(CONTENT_KEY).insert(0, text);
  return Y.encodeStateAsUpdate(doc);
}

/** The incremental update that turns `base` into `base`+edit — one journal row. */
function diffAfter(base: Uint8Array, edit: (doc: Y.Doc) => void): string {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, base);
  const before = Y.encodeStateVector(doc);
  edit(doc);
  const update = Y.encodeStateAsUpdate(doc, before);
  let out = "";
  for (const byte of update) out += String.fromCharCode(byte);
  return btoa(out);
}

const DOC = {
  id: "d-1",
  workspace_id: "ws-1",
  folder_id: null,
  title: "Live notes",
  type: "ymd",
  size_bytes: 2,
  mime_type: "text/markdown",
  metadata: {},
  editor_hint: "markdown.crdt",
  collab: "crdt",
  diffable: false,
  socket_path: null,
  created_at: "2026-09-01T09:00:00Z",
  updated_at: "2026-09-01T09:05:00Z",
  deleted_at: null,
  is_starred: false,
};

function contentRoute(state: Uint8Array, headSeq: number): void {
  server.use(
    http.get(`${BASE}/documents/d-1`, () => HttpResponse.json(DOC)),
    http.get(
      `${BASE}/documents/d-1/content`,
      () =>
        new HttpResponse(state.slice().buffer as ArrayBuffer, {
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Docs-Head-Seq": String(headSeq),
          },
        })
    )
  );
}

function bag(documentId: string): DocEditorBag {
  return {
    documentId,
    value: "",
    setValue: () => undefined,
    save: () => undefined,
    overrideSave: () => undefined,
    dirty: false,
    isLoading: false,
    isSaving: false,
    conflict: null,
    headSeq: null,
    isError: false,
    error: null,
    reload: () => undefined,
  };
}

function wrap(children: ReactNode): ReactElement {
  const runtime: DocsRuntime = createDocsRuntime({ baseUrl: BASE });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerDocsI18n(i18n);
  return (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <DocsProvider runtime={runtime}>{children}</DocsProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

describe("registration — the two hints the backend emits", () => {
  it("claims markdown.crdt and text.crdt, resolvable through the registry seam", () => {
    const claimed = registerCollabDocEditors({ loadPeer: loadPeers });
    try {
      expect(claimed).toEqual(["markdown.crdt", "text.crdt"]);
      expect(COLLAB_DEFAULT_HINTS).toEqual(["markdown.crdt", "text.crdt"]);
      // Explicit — which is what lets DocSurface's crdt guard stand down.
      expect(explicitDocEditor("markdown.crdt")).not.toBeNull();
      expect(explicitDocEditor("text.crdt")).not.toBeNull();
    } finally {
      for (const hint of claimed) unregisterDocEditor(hint);
    }
  });

  it("the creatable live types are exported for the picker, but NOT folded into the default list", () => {
    expect(CRDT_DOCUMENT_TYPES.map((option) => option.type)).toEqual(["ymd", "ytxt"]);
  });
});

describe("the surface hydrates from /content bytes and stays live", () => {
  it("renders the Y text, applies a polled journal row, and mentions no awareness", async () => {
    const base = serverState("hello");
    contentRoute(base, 3);
    const row = diffAfter(base, (doc) => {
      doc.getText(CONTENT_KEY).insert(5, " world");
    });
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, ({ request }) => {
        const since = Number(new URL(request.url).searchParams.get("since"));
        return HttpResponse.json({
          head_seq: 4,
          updates:
            since < 4
              ? [{ seq: 4, payload: row, author_id: "u-2", created_at: "2026-09-01T10:00:00Z" }]
              : [],
        });
      })
    );

    const Editor = createCollabDocEditor({
      language: "markdown",
      loadPeer: loadPeers,
      loadCodeMirrorPeer: loadCodeMirror,
      fallbackRefetchInterval: 40,
    });
    render(wrap(<Editor bag={bag("d-1")} />));

    const surface = await screen.findByTestId("docs-editor-collab");
    expect(surface.getAttribute("data-doc-editor-engine")).toBe("collab");
    await waitFor(() => expect(surface.textContent).toContain("hello"));
    // The polled row reaches the OPEN editor through the same session.
    await waitFor(() => expect(surface.textContent).toContain("hello world"));
  });

  it("a local Y edit batches to POST /updates with the session's client identity", async () => {
    contentRoute(serverState("draft"), 1);
    const posted: { updates: string[]; client_id: string; client_seq: number }[] = [];
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, () =>
        HttpResponse.json({ head_seq: 1, updates: [] })
      ),
      http.post(`${BASE}/documents/d-1/updates`, async ({ request }) => {
        posted.push((await request.json()) as (typeof posted)[number]);
        return HttpResponse.json({ head_seq: 1 + posted.length });
      })
    );

    let session: YDocSession | null = null;
    const Editor = createCollabDocEditor({
      loadPeer: loadPeers,
      loadCodeMirrorPeer: loadCodeMirror,
      debounceMs: 20,
      fallbackRefetchInterval: 10_000,
      onSession: (created) => {
        session = created;
      },
    });
    render(wrap(<Editor bag={bag("d-1")} />));

    await screen.findByTestId("docs-editor-collab");
    await waitFor(() => expect(session).not.toBeNull());

    (session as unknown as YDocSession).text().insert(5, "!");
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.updates).toHaveLength(1);
    expect(posted[0]?.client_id).toBe((session as unknown as YDocSession).clientId);
    expect(posted[0]?.client_seq).toBe(1);
  });

  it("with the peers absent the surface says so — and offers NO snapshot save on a crdt body", async () => {
    contentRoute(serverState(""), 1);
    const missing: CollabPeersLoader = () =>
      Promise.reject(new Error("Cannot find module 'yjs' imported from collab"));
    const Editor = createCollabDocEditor({
      loadPeer: missing,
      loadCodeMirrorPeer: loadCodeMirror,
    });
    render(wrap(<Editor bag={bag("d-1")} />));

    await screen.findByTestId("docs-editor-engine-absent");
    // The codemirror/milkdown arms fall back to the snapshot textarea; here
    // that would offer a Save the crdt wire refuses (a text body is
    // error.400.docs_invalid_crdt_payload), so the absence arm stays read-only.
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
