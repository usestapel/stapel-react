/**
 * The share axis (stapel-docs 0.6), end to end through the pair: the client
 * methods, the two listings, the four writes, and the two headless bags.
 *
 * The properties asserted here are the ones a re-skin can silently lose:
 *
 *  - a mint REFRESHES the link list (a sheet that mints and shows nothing is
 *    the sheet that makes people mint a second link);
 *  - a suspended row is RENDERED, never filtered — the kill switch is a
 *    display state, and an operator who cannot see an inert grant believes it
 *    was revoked;
 *  - a 403 on a listing is the CAPABILITY answer, not a load failure, because
 *    both endpoints are themselves the sharing gates;
 *  - the bearer envelope is stripped, and every dead token answers 404 alike.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { ShareSheet } from "../src/headless/ShareSheet.js";
import { SharedDocumentView } from "../src/headless/SharedDocumentView.js";
import type { ShareSheetBag } from "../src/headless/ShareSheet.js";
import type { SharedDocumentViewBag } from "../src/headless/SharedDocumentView.js";
import {
  useDocumentAccess,
  useDocumentLinks,
  useSharedDocument,
} from "../src/model/queries.js";
import {
  useGrantAccess,
  useMintShareLink,
  useRevokeAccess,
  useRevokeShareLink,
} from "../src/model/mutations.js";
import { DOCS_SHARE_ERROR_CODES } from "../src/i18n/errorsMap.js";

const BASE = "https://docs.stapel.test/docs/api/v1";
const DOC = "d-1";
const TOKEN = "0xk3nEXAMPLEtoken";

const GRANT = {
  id: "acc-1",
  document_id: DOC,
  subject_kind: "user",
  subject: "u-mira",
  level: "view",
  granted_by: "u-owner",
  suspended: false,
  created_at: "2026-09-02T10:00:00Z",
};

const LINK = {
  id: "lnk-1",
  document_id: DOC,
  token: TOKEN,
  level: "view",
  status: "active",
  expires_at: "2026-10-02T10:00:00Z",
  revoked_at: null,
  first_redeemed_at: null,
  created_by: "u-owner",
  suspended: false,
  created_at: "2026-09-02T10:00:00Z",
};

const SHARED = {
  id: DOC,
  type: "md",
  title: "Release notes",
  head_seq: 7,
  size_bytes: 4210,
  mime_type: "text/markdown",
  editor_hint: "markdown",
  collab: "snapshot",
  diffable: true,
  level: "view",
  updated_at: "2026-09-01T09:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function runtime(): DocsRuntime {
  return createDocsRuntime({ baseUrl: BASE });
}

function wrap(rt: DocsRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <DocsProvider runtime={rt}>{children}</DocsProvider>
    </QueryClientProvider>
  );
}

function hookWrapper(rt: DocsRuntime): (p: { children: ReactNode }) => ReactElement {
  return ({ children }) => wrap(rt, children);
}

describe("the whitelist half", () => {
  it("lists grants and posts a grant that names exactly one subject", async () => {
    let body: unknown = null;
    server.use(
      http.get(`${BASE}/documents/${DOC}/access`, () => HttpResponse.json([GRANT])),
      http.post(`${BASE}/documents/${DOC}/access`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(GRANT, { status: 201 });
      })
    );
    const rt = runtime();
    const list = renderHook(() => useDocumentAccess(DOC), {
      wrapper: hookWrapper(rt),
    });
    await waitFor(() => expect(list.result.current.data).toHaveLength(1));

    const grant = renderHook(() => useGrantAccess(DOC), {
      wrapper: hookWrapper(rt),
    });
    grant.result.current.mutate({
      subject_kind: "user",
      user_id: "u-mira",
      level: "view",
    });
    await waitFor(() => expect(grant.result.current.isSuccess).toBe(true));
    expect(body).toEqual({
      subject_kind: "user",
      user_id: "u-mira",
      level: "view",
    });
  });

  it("revokes one grant by its own id, scoped to the document", async () => {
    let hit = "";
    server.use(
      http.delete(`${BASE}/documents/${DOC}/access/:accessId`, ({ request }) => {
        hit = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result } = renderHook(() => useRevokeAccess(DOC), {
      wrapper: hookWrapper(runtime()),
    });
    result.current.mutate("acc-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hit).toBe(`/docs/api/v1/documents/${DOC}/access/acc-1`);
  });

  it("surfaces a disabled mode as its own code, not as a generic failure", async () => {
    server.use(
      http.post(`${BASE}/documents/${DOC}/access`, () =>
        HttpResponse.json(
          { localizable_error: DOCS_SHARE_ERROR_CODES.modeDisabled, error: "off" },
          { status: 400 }
        )
      )
    );
    const { result } = renderHook(() => useGrantAccess(DOC), {
      wrapper: hookWrapper(runtime()),
    });
    result.current.mutate({ subject_kind: "user", user_id: "u-mira", level: "view" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe(DOCS_SHARE_ERROR_CODES.modeDisabled);
    expect(result.current.error?.status).toBe(400);
  });
});

describe("the bearer-link half", () => {
  it("mints a link and INVALIDATES the listing, so the sheet shows what it made", async () => {
    let listCalls = 0;
    server.use(
      http.get(`${BASE}/documents/${DOC}/links`, () => {
        listCalls += 1;
        return HttpResponse.json(listCalls === 1 ? [] : [LINK]);
      }),
      http.post(`${BASE}/documents/${DOC}/links`, () =>
        HttpResponse.json(LINK, { status: 201 })
      )
    );
    const rt = runtime();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={queryClient}>
        <DocsProvider runtime={rt}>{children}</DocsProvider>
      </QueryClientProvider>
    );

    const list = renderHook(() => useDocumentLinks(DOC), { wrapper });
    await waitFor(() => expect(list.result.current.data).toEqual([]));

    const mint = renderHook(() => useMintShareLink(DOC), { wrapper });
    mint.result.current.mutate({ level: "view" });
    await waitFor(() => expect(mint.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(list.result.current.data).toHaveLength(1));
    expect(list.result.current.data?.[0]?.token).toBe(TOKEN);
  });

  it("refuses a level above the deployment cap by name — it never clamps", async () => {
    server.use(
      http.post(`${BASE}/documents/${DOC}/links`, () =>
        HttpResponse.json(
          { localizable_error: DOCS_SHARE_ERROR_CODES.level, error: "too high" },
          { status: 400 }
        )
      )
    );
    const { result } = renderHook(() => useMintShareLink(DOC), {
      wrapper: hookWrapper(runtime()),
    });
    result.current.mutate({ level: "edit" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe(DOCS_SHARE_ERROR_CODES.level);
  });

  it("revokes a link at its own path", async () => {
    let hit = "";
    server.use(
      http.delete(`${BASE}/documents/${DOC}/links/:linkId`, ({ request }) => {
        hit = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result } = renderHook(() => useRevokeShareLink(DOC), {
      wrapper: hookWrapper(runtime()),
    });
    result.current.mutate("lnk-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hit).toBe(`/docs/api/v1/documents/${DOC}/links/lnk-1`);
  });
});

describe("<ShareSheet/> — the composed bag", () => {
  function mount(): { bag: () => ShareSheetBag } {
    let latest: ShareSheetBag | null = null;
    render(
      wrap(
        runtime(),
        <ShareSheet documentId={DOC}>
          {(bag) => {
            latest = bag;
            return <div data-testid="sheet" />;
          }}
        </ShareSheet>
      )
    );
    return {
      bag: () => {
        if (latest === null) throw new Error("the sheet never rendered");
        return latest;
      },
    };
  }

  it("SHOWS a suspended row rather than filtering it out", async () => {
    server.use(
      http.get(`${BASE}/documents/${DOC}/access`, () =>
        HttpResponse.json([{ ...GRANT, suspended: true }])
      ),
      http.get(`${BASE}/documents/${DOC}/links`, () =>
        HttpResponse.json([{ ...LINK, suspended: true }])
      )
    );
    const { bag } = mount();
    await waitFor(() => expect(bag().grants.status).toBe("ready"));
    await waitFor(() => expect(bag().links.status).toBe("ready"));

    const grants = bag().grants;
    expect(grants.status === "ready" && grants.data).toHaveLength(1);
    expect(bag().whitelistSuspended).toBe(true);
    expect(bag().linksSuspended).toBe(true);
    // Suspended is inert, NOT revoked: the row keeps its level so an operator
    // can see what switching the mode back on would restore.
    expect(grants.status === "ready" && grants.data[0]?.level).toBe("view");
  });

  it("reads a 403 on a listing as the capability, not as a broken load", async () => {
    server.use(
      http.get(`${BASE}/documents/${DOC}/access`, () =>
        HttpResponse.json({ localizable_error: "error.403.forbidden" }, { status: 403 })
      ),
      http.get(`${BASE}/documents/${DOC}/links`, () => HttpResponse.json([LINK]))
    );
    const { bag } = mount();
    await waitFor(() => expect(bag().grants.status).toBe("failed"));
    expect(bag().canGrantAccess).toBe(false);
    await waitFor(() => expect(bag().canMintLinks).toBe(true));
  });

  it("names a refused mint level instead of folding it into 'went wrong'", async () => {
    server.use(
      http.get(`${BASE}/documents/${DOC}/access`, () => HttpResponse.json([])),
      http.get(`${BASE}/documents/${DOC}/links`, () => HttpResponse.json([])),
      http.post(`${BASE}/documents/${DOC}/links`, () =>
        HttpResponse.json({ localizable_error: DOCS_SHARE_ERROR_CODES.level }, { status: 400 })
      )
    );
    const { bag } = mount();
    await waitFor(() => expect(bag().links.status).toBe("ready"));
    bag().mintLink("edit");
    await waitFor(() => expect(bag().levelRefused).toBe(true));
    expect(bag().modeDisabled).toBe(false);
  });

  it("costs no request while it is closed", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/documents/${DOC}/access`, () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
      http.get(`${BASE}/documents/${DOC}/links`, () => {
        calls += 1;
        return HttpResponse.json([]);
      })
    );
    render(
      wrap(
        runtime(),
        <ShareSheet documentId={DOC} enabled={false}>
          {() => <div data-testid="closed" />}
        </ShareSheet>
      )
    );
    await screen.findByTestId("closed");
    expect(calls).toBe(0);
  });
});

describe("<SharedDocumentView/> — the bearer surface", () => {
  function mount(token = TOKEN): { bag: () => SharedDocumentViewBag } {
    let latest: SharedDocumentViewBag | null = null;
    render(
      wrap(
        runtime(),
        <SharedDocumentView token={token} withContent={false}>
          {(bag) => {
            latest = bag;
            return <div data-testid="bearer" />;
          }}
        </SharedDocumentView>
      )
    );
    return {
      bag: () => {
        if (latest === null) throw new Error("the bearer view never rendered");
        return latest;
      },
    };
  }

  it("carries the stripped envelope and the level — and nothing around it", async () => {
    server.use(
      http.get(`${BASE}/shared/${TOKEN}`, () => HttpResponse.json(SHARED))
    );
    const { bag } = mount();
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    const state = bag().state;
    expect(state.status === "ready" && state.data.title).toBe("Release notes");
    expect(bag().level).toBe("view");
    expect(bag().readOnly).toBe(true);
    // The bearer is told nothing about the workspace around the document.
    const keys = Object.keys(state.status === "ready" ? state.data : {});
    expect(keys).not.toContain("workspace_id");
    expect(keys).not.toContain("folder_id");
    expect(keys).not.toContain("is_starred");
  });

  it("says one sentence for every dead token — the endpoint is not an oracle", async () => {
    server.use(
      http.get(`${BASE}/shared/${TOKEN}`, () =>
        HttpResponse.json({ localizable_error: "error.404.docs_document_not_found" }, { status: 404 })
      )
    );
    const { bag } = mount();
    await waitFor(() => expect(bag().notFound).toBe(true));
    expect(bag().authRequired).toBe(false);
  });

  it("tells 'sign in first' apart from 'this link is dead'", async () => {
    server.use(
      http.get(`${BASE}/shared/${TOKEN}`, () =>
        HttpResponse.json(
          { localizable_error: "error.401.docs_share_auth_required" },
          { status: 401 }
        )
      )
    );
    const { bag } = mount();
    await waitFor(() => expect(bag().authRequired).toBe(true));
    expect(bag().notFound).toBe(false);
  });

  it("reads the bearer's body on the token path, never a document path", async () => {
    let contentPath = "";
    server.use(
      http.get(`${BASE}/shared/${TOKEN}`, () => HttpResponse.json(SHARED)),
      http.get(`${BASE}/shared/${TOKEN}/content`, ({ request }) => {
        contentPath = new URL(request.url).pathname;
        return new HttpResponse("# Release notes\n", {
          status: 200,
          headers: { "content-type": "text/markdown", "X-Docs-Head-Seq": "7" },
        });
      })
    );
    let latest: SharedDocumentViewBag | null = null;
    const seen = (): SharedDocumentViewBag => {
      if (latest === null) throw new Error("the bearer view never rendered");
      return latest;
    };
    render(
      wrap(
        runtime(),
        <SharedDocumentView token={TOKEN} withContent>
          {(bag) => {
            latest = bag;
            return <div data-testid="bearer-content" />;
          }}
        </SharedDocumentView>
      )
    );
    await waitFor(() => expect(seen().content?.status).toBe("ready"));
    expect(contentPath).toBe(`/docs/api/v1/shared/${TOKEN}/content`);
    const content = seen().content;
    expect(content?.status === "ready" && content.data.headSeq).toBe(7);
  });

  it("mints the bearer download URL on demand, never parking a stale href", async () => {
    server.use(
      http.get(`${BASE}/shared/${TOKEN}`, () => HttpResponse.json(SHARED)),
      http.get(`${BASE}/shared/${TOKEN}/download`, () =>
        HttpResponse.json({ url: "https://objects.test/blob?sig=1" })
      )
    );
    const { bag } = mount();
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    expect(bag().downloadUrl).toBeNull();
    bag().download();
    await waitFor(() =>
      expect(bag().downloadUrl).toBe("https://objects.test/blob?sig=1")
    );
  });

  it("reads a shared query key by TOKEN, not by document id", async () => {
    const { result } = renderHook(() => useSharedDocument(""), {
      wrapper: hookWrapper(runtime()),
    });
    // An empty token never fires: there is nothing to ask about.
    expect(result.current.fetchStatus).toBe("idle");
  });
});
