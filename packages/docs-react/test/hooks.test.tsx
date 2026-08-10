import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import {
  useDocumentContent,
  useDocuments,
  useFolderTree,
  useRevisions,
  useTrash,
} from "../src/model/queries.js";
import {
  useExportUrl,
  useSaveContent,
  useTrashActions,
  useUpload,
} from "../src/model/mutations.js";

/** Base the msw handlers mount on (mirrors stapel-docs `/docs/api/v1`). */
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
  collab: false,
  diffable: true,
  created_at: "2026-08-01T09:00:00Z",
  updated_at: "2026-08-02T09:00:00Z",
};

const REVISION = {
  id: "rev-1",
  name: "before rewrite",
  seq: 3,
  author_id: "u-1",
  created_at: "2026-08-02T08:00:00Z",
};

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

function hookWrapper(
  runtime: DocsRuntime
): (props: { children: ReactNode }) => ReactElement {
  return ({ children }) => wrap(runtime, children);
}

describe("useFolderTree", () => {
  it("assembles the flat folder read into a parent_id tree", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BASE}/folders`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([FOLDER_ROOT, FOLDER_CHILD]);
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useFolderTree("ws-1"), {
      wrapper: hookWrapper(runtime),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenUrl).toContain("workspace_id=ws-1");
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.folder.id).toBe("f-root");
    expect(result.current.data?.[0]?.children[0]?.folder.id).toBe("f-child");
  });
});

describe("useDocuments", () => {
  it("passes the workspace scope and the optional filters", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BASE}/documents`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([DOCUMENT]);
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(
      () =>
        useDocuments({ workspaceId: "ws-1", folderId: "f-root", q: "design" }),
      { wrapper: hookWrapper(runtime) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenUrl).toContain("workspace_id=ws-1");
    expect(seenUrl).toContain("folder_id=f-root");
    expect(seenUrl).toContain("q=design");
    expect(result.current.data?.[0]?.editor_hint).toBe("markdown");
  });
});

describe("useDocumentContent", () => {
  it("decodes the raw bytes and reads head_seq off the response header", async () => {
    server.use(
      http.get(`${BASE}/documents/d-1/content`, () =>
        HttpResponse.text("hello docs", {
          headers: { "X-Docs-Head-Seq": "4", ETag: '"4"' },
        })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useDocumentContent("d-1"), {
      wrapper: hookWrapper(runtime),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.text).toBe("hello docs");
    expect(result.current.data?.headSeq).toBe(4);
  });
});

describe("useSaveContent (snapshot discipline)", () => {
  it("PUTs the body with If-Match and resolves the saved arm", async () => {
    let seenIfMatch: string | null = null;
    let seenBody = "";
    server.use(
      http.put(`${BASE}/documents/d-1/content`, async ({ request }) => {
        seenIfMatch = request.headers.get("If-Match");
        seenBody = await request.text();
        return HttpResponse.json({ head_seq: 5, revision_id: "rev-9" });
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useSaveContent("d-1"), {
      wrapper: hookWrapper(runtime),
    });
    result.current.mutate({ body: "new text", ifMatchSeq: 4 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenIfMatch).toBe("4");
    expect(seenBody).toBe("new text");
    expect(result.current.data).toEqual({
      status: "saved",
      headSeq: 5,
      revisionId: "rev-9",
    });
  });

  it("folds a 409 into the typed conflict arm (state, not exception)", async () => {
    server.use(
      http.put(`${BASE}/documents/d-1/content`, () =>
        HttpResponse.json(
          { head_seq: 7, saved_by: "u-2", saved_at: "2026-08-02T10:00:00Z" },
          { status: 409 }
        )
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useSaveContent("d-1"), {
      wrapper: hookWrapper(runtime),
    });
    result.current.mutate({ body: "mine", ifMatchSeq: 4 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      status: "conflict",
      conflict: {
        headSeq: 7,
        savedBy: "u-2",
        savedAt: "2026-08-02T10:00:00Z",
      },
    });
  });

  it("folds a bare 412 into a null-field conflict", async () => {
    server.use(
      http.put(
        `${BASE}/documents/d-1/content`,
        () => new HttpResponse(null, { status: 412 })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useSaveContent("d-1"), {
      wrapper: hookWrapper(runtime),
    });
    result.current.mutate({ body: "mine", ifMatchSeq: 4 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      status: "conflict",
      conflict: { headSeq: null, savedBy: null, savedAt: null },
    });
  });

  it("rejects a real failure through the real transport (no .status invention)", async () => {
    server.use(
      http.put(`${BASE}/documents/d-1/content`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.403.forbidden",
            error: "You do not have permission to perform this action",
            params: {},
          },
          { status: 403 }
        )
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useSaveContent("d-1"), {
      wrapper: hookWrapper(runtime),
    });
    result.current.mutate({ body: "mine", ifMatchSeq: 4 });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("error.403.forbidden");
    expect(result.current.error?.status).toBe(403);
  });
});

describe("useRevisions", () => {
  it("reads the document's revisions", async () => {
    server.use(
      http.get(`${BASE}/documents/d-1/revisions`, () =>
        HttpResponse.json([REVISION])
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useRevisions("d-1"), {
      wrapper: hookWrapper(runtime),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.name).toBe("before rewrite");
  });
});

describe("useTrash + useTrashActions", () => {
  it("reads the workspace trash and empties selected ids", async () => {
    let emptied: unknown = null;
    server.use(
      http.get(`${BASE}/trash`, () => HttpResponse.json([DOCUMENT])),
      http.post(`${BASE}/trash/empty`, async ({ request }) => {
        emptied = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(
      () => ({ trash: useTrash("ws-1"), actions: useTrashActions() }),
      { wrapper: hookWrapper(runtime) }
    );
    await waitFor(() => expect(result.current.trash.isSuccess).toBe(true));
    expect(result.current.trash.data).toHaveLength(1);

    result.current.actions.emptyTrash.mutate({
      workspace_id: "ws-1",
      ids: ["d-1"],
    });
    await waitFor(() =>
      expect(result.current.actions.emptyTrash.isSuccess).toBe(true)
    );
    expect(emptied).toEqual({ workspace_id: "ws-1", ids: ["d-1"] });
  });

  it("restores a document out of the trash", async () => {
    let restored = false;
    server.use(
      http.post(`${BASE}/documents/d-1/restore`, () => {
        restored = true;
        return HttpResponse.json(DOCUMENT);
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useTrashActions(), {
      wrapper: hookWrapper(runtime),
    });
    result.current.restoreDocument.mutate("d-1");
    await waitFor(() =>
      expect(result.current.restoreDocument.isSuccess).toBe(true)
    );
    expect(restored).toBe(true);
  });
});

describe("useUpload", () => {
  const UPLOAD = {
    upload_id: "up-1",
    document_id: "d-9",
    key: "docs/ws-1/d-9",
    put_url: "https://store.stapel.test/put/up-1",
  };

  it("put_url path: POST /uploads → PUT bytes at put_url → finalize", async () => {
    const calls: string[] = [];
    server.use(
      http.post(`${BASE}/uploads`, async ({ request }) => {
        calls.push("create");
        expect(await request.json()).toMatchObject({
          workspace_id: "ws-1",
          title: "spec.pdf",
        });
        return HttpResponse.json(UPLOAD);
      }),
      // Sequencing is the contract under test; the byte payload itself is
      // runtime plumbing (msw's node interceptor stringifies a Blob body).
      http.put(UPLOAD.put_url, () => {
        calls.push("put");
        return new HttpResponse(null, { status: 200 });
      }),
      http.post(`${BASE}/uploads/up-1/finalize`, () => {
        calls.push("finalize");
        return HttpResponse.json(DOCUMENT);
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useUpload(), {
      wrapper: hookWrapper(runtime),
    });
    result.current.mutate({
      file: new Blob(["PDFBYTES"], { type: "application/pdf" }),
      workspaceId: "ws-1",
      title: "spec.pdf",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toEqual(["create", "put", "finalize"]);
    expect(result.current.data).toEqual({
      documentId: "d-9",
      uploadId: "up-1",
      via: "put_url",
    });
  });

  it("content path (local-storage profile): PUT /documents/:id/content instead of put_url", async () => {
    const calls: string[] = [];
    server.use(
      http.post(`${BASE}/uploads`, () => {
        calls.push("create");
        return HttpResponse.json(UPLOAD);
      }),
      http.get(`${BASE}/documents/d-9`, () => {
        calls.push("head");
        return HttpResponse.json({ ...DOCUMENT, id: "d-9", head_seq: 0 });
      }),
      http.put(`${BASE}/documents/d-9/content`, ({ request }) => {
        calls.push("content");
        expect(request.headers.get("If-Match")).toBe("0");
        return HttpResponse.json({ head_seq: 1, revision_id: "rev-1" });
      })
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useUpload(), {
      wrapper: hookWrapper(runtime),
    });
    result.current.mutate({
      file: new Blob(["text body"], { type: "text/plain" }),
      workspaceId: "ws-1",
      title: "notes.txt",
      via: "content",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toEqual(["create", "head", "content"]);
    expect(result.current.data?.via).toBe("content");
  });
});

describe("useExportUrl", () => {
  it("mints the opaque download url on demand", async () => {
    server.use(
      http.get(`${BASE}/documents/d-1/download`, () =>
        HttpResponse.json({ url: "https://cdn.stapel.test/signed/d-1" })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useExportUrl(), {
      wrapper: hookWrapper(runtime),
    });
    result.current.mutate({ documentId: "d-1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe("https://cdn.stapel.test/signed/d-1");
  });
});
