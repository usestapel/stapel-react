import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { DocEditor } from "../src/headless/DocEditor.js";
import type { DocEditorBag } from "../src/headless/DocEditor.js";
import {
  registerDocEditor,
  unregisterDocEditor,
  resolveDocEditor,
  registeredDocEditorHints,
} from "../src/editors/registry.js";
import { TextEditor } from "../src/editors/builtin/TextEditor.js";
import { MarkdownEditor } from "../src/editors/builtin/MarkdownEditor.js";
import { CsvEditor } from "../src/editors/builtin/CsvEditor.js";

const BASE = "https://docs.stapel.test/docs/api/v1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrap(runtime: DocsRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <DocsProvider runtime={runtime}>{children}</DocsProvider>
    </QueryClientProvider>
  );
}

describe("editor registry (the customer seam)", () => {
  it("resolves builtins for text / markdown / csv", () => {
    expect(resolveDocEditor("text")).toBe(TextEditor);
    expect(resolveDocEditor("markdown")).toBe(MarkdownEditor);
    expect(resolveDocEditor("csv")).toBe(CsvEditor);
  });

  it("unknown hint resolves null (download-only presentation)", () => {
    expect(resolveDocEditor("whiteboard")).toBeNull();
  });

  it("explicit registration wins over a builtin, without a fork", () => {
    function Custom(): ReactElement {
      return <div data-doc-editor="custom-text" />;
    }
    try {
      registerDocEditor("text", Custom);
      expect(resolveDocEditor("text")).toBe(Custom);
    } finally {
      unregisterDocEditor("text");
    }
    expect(resolveDocEditor("text")).toBe(TextEditor);
  });

  it("a customer hint registers and unregisters cleanly", () => {
    function Board(): ReactElement {
      return <div data-doc-editor="board" />;
    }
    try {
      registerDocEditor("whiteboard", Board);
      expect(resolveDocEditor("whiteboard")).toBe(Board);
      expect(registeredDocEditorHints()).toContain("whiteboard");
    } finally {
      unregisterDocEditor("whiteboard");
    }
    expect(resolveDocEditor("whiteboard")).toBeNull();
  });
});

describe("<DocEditor> + builtin TextEditor (snapshot If-Match discipline)", () => {
  function mountEditor(): { runtime: DocsRuntime; bag: () => DocEditorBag } {
    const runtime = createDocsRuntime({ baseUrl: BASE });
    let latest: DocEditorBag | null = null;
    render(
      wrap(
        runtime,
        <DocEditor documentId="d-1">
          {(bag) => {
            latest = bag;
            return <TextEditor bag={bag} />;
          }}
        </DocEditor>
      )
    );
    return {
      runtime,
      bag: () => {
        if (latest === null) throw new Error("bag not rendered yet");
        return latest;
      },
    };
  }

  it("loads content, edits through the textarea, saves at the loaded head", async () => {
    // Stateful wire mock: the save mutation invalidates the content read, so
    // the refetch must return the SAVED state — exactly what a real backend
    // does (a static handler would dishonestly rewind the editor).
    const state = { text: "hello", seq: 4 };
    let seenIfMatch: string | null = null;
    let seenBody = "";
    server.use(
      http.get(`${BASE}/documents/d-1/content`, () =>
        HttpResponse.text(state.text, {
          headers: { "X-Docs-Head-Seq": String(state.seq) },
        })
      ),
      http.put(`${BASE}/documents/d-1/content`, async ({ request }) => {
        seenIfMatch = request.headers.get("If-Match");
        seenBody = await request.text();
        state.text = seenBody;
        state.seq += 1;
        return HttpResponse.json({ head_seq: state.seq, revision_id: "rev-2" });
      })
    );
    const { bag } = mountEditor();

    const textarea = await screen.findByDisplayValue("hello");
    fireEvent.change(textarea, { target: { value: "hello world" } });
    await screen.findByDisplayValue("hello world");
    expect(bag().dirty).toBe(true);

    // Drive the save through the bag (a host's save button does exactly this).
    act(() => {
      bag().save();
    });
    await waitFor(() => expect(bag().dirty).toBe(false));
    expect(seenIfMatch).toBe("4");
    expect(seenBody).toBe("hello world");
    await waitFor(() => expect(bag().headSeq).toBe(5));
  });

  it("full cycle: dirty → save → conflict (typed state) → overrideSave lands at the new head", async () => {
    // Stateful wire mock: u-2 has already saved past our loaded seq (head is
    // 7 while we loaded at 4), so our first PUT conflicts; the override
    // re-reads the head and lands at 8. GET handlers serve the CURRENT state
    // throughout — the honest wire, since the conflict invalidates the
    // content read too.
    const state = { text: "theirs", seq: 7 };
    const loadedOnce = { done: false };
    const ifMatches: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/documents/d-1/content`, () => {
        // First read happened before u-2's save (that is the premise of the
        // conflict); later refetches see the current head.
        if (!loadedOnce.done) {
          loadedOnce.done = true;
          return HttpResponse.text("hello", {
            headers: { "X-Docs-Head-Seq": "4" },
          });
        }
        return HttpResponse.text(state.text, {
          headers: { "X-Docs-Head-Seq": String(state.seq) },
        });
      }),
      http.get(`${BASE}/documents/d-1`, () =>
        HttpResponse.json({
          id: "d-1",
          workspace_id: "ws-1",
          folder_id: null,
          type: "note",
          title: "Notes",
          head_seq: state.seq,
          snapshot_seq: state.seq,
          size_bytes: state.text.length,
          mime_type: "text/plain",
          metadata: {},
          editor_hint: "text",
          collab: false,
          diffable: true,
          created_at: "2026-08-01T09:00:00Z",
          updated_at: "2026-08-02T09:00:00Z",
        })
      ),
      http.put(`${BASE}/documents/d-1/content`, async ({ request }) => {
        const ifMatch = request.headers.get("If-Match");
        ifMatches.push(ifMatch);
        if (Number(ifMatch) !== state.seq) {
          // Someone saved past our seq while we were editing.
          return HttpResponse.json(
            {
              head_seq: state.seq,
              saved_by: "u-2",
              saved_at: "2026-08-02T10:00:00Z",
            },
            { status: 409 }
          );
        }
        state.text = await request.text();
        state.seq += 1;
        return HttpResponse.json({ head_seq: state.seq, revision_id: "rev-3" });
      })
    );
    const { bag } = mountEditor();

    await waitFor(() => expect(bag().isLoading).toBe(false));
    expect(bag().headSeq).toBe(4);
    expect(bag().dirty).toBe(false);

    act(() => {
      bag().setValue("mine");
    });
    expect(bag().dirty).toBe(true);

    act(() => {
      bag().save();
    });
    await waitFor(() => expect(bag().conflict).not.toBeNull());
    expect(bag().conflict).toEqual({
      headSeq: 7,
      savedBy: "u-2",
      savedAt: "2026-08-02T10:00:00Z",
    });
    expect(ifMatches).toEqual(["4"]);

    // Override: re-reads the fresh head (7) and lands as a new revision (8).
    act(() => {
      bag().overrideSave();
    });
    await waitFor(() => expect(bag().conflict).toBeNull());
    expect(ifMatches).toEqual(["4", "7"]);
    await waitFor(() => expect(bag().headSeq).toBe(8));
    expect(bag().dirty).toBe(false);
  });
});

describe("builtin CsvEditor (rows model)", () => {
  it("renders the parsed grid and serializes a cell edit back to the bag", async () => {
    server.use(
      http.get(`${BASE}/documents/d-2/content`, () =>
        HttpResponse.text("a,b\nc,d", { headers: { "X-Docs-Head-Seq": "1" } })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    let latest: DocEditorBag | null = null;
    render(
      wrap(
        runtime,
        <DocEditor documentId="d-2">
          {(bag) => {
            latest = bag;
            return <CsvEditor bag={bag} />;
          }}
        </DocEditor>
      )
    );

    const cell = await screen.findByDisplayValue("b");
    fireEvent.change(cell, { target: { value: "b,2" } });

    await waitFor(() => {
      if (latest === null) throw new Error("bag not rendered");
      expect((latest as DocEditorBag).value).toBe('a,"b,2"\nc,d');
    });
    expect((latest as unknown as DocEditorBag).dirty).toBe(true);
  });
});
