/**
 * The journal poll (`useDocUpdates`) and the journal append
 * (`useAppendUpdates`) — the first consumers of `getUpdates`/`postUpdate`,
 * which the client has carried since 0.1.0 with nothing reading them.
 *
 * Everything here drives the REAL transport through MSW ("mock the wire, not
 * the module"): the resync branch in particular is a shape the pair TYPED by
 * hand, because `docs/schema.json` declares only the feed branch — so a
 * hand-built response object would be the pair's own belief tested against
 * itself. What goes over the wire below is the backend's literal
 * `dto.ResyncDTO` body.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { docsQueryKeys } from "../src/model/queryKeys.js";
import { DOC_UPDATES_INTERVAL_MS, useDocUpdates } from "../src/model/updates.js";
import type { DocUpdatesBag, DocUpdatesOptions } from "../src/model/updates.js";
import { useAppendUpdates } from "../src/model/mutations.js";
import { useDocumentContent } from "../src/model/queries.js";

const BASE = "https://docs.stapel.test/docs/api/v1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function row(seq: number): {
  seq: number;
  payload: string;
  author_id: string | null;
  created_at: string;
} {
  return {
    seq,
    payload: `u${String(seq)}`,
    author_id: "u-2",
    created_at: "2026-08-31T10:00:00Z",
  };
}

function harness(): {
  client: QueryClient;
  wrap: (children: ReactNode) => ReactElement;
} {
  const runtime: DocsRuntime = createDocsRuntime({ baseUrl: BASE });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    wrap: (children) => (
      <QueryClientProvider client={client}>
        <DocsProvider runtime={runtime}>{children}</DocsProvider>
      </QueryClientProvider>
    ),
  };
}

/** Mount the hook and keep its bag reachable, the way a binding would use it. */
function mountPoll(options: DocUpdatesOptions = {}): {
  client: QueryClient;
  bag: () => DocUpdatesBag;
} {
  const { client, wrap } = harness();
  let latest: DocUpdatesBag | null = null;
  function Probe(): ReactElement {
    latest = useDocUpdates("d-1", options);
    return <span data-testid="since">{latest.since}</span>;
  }
  render(wrap(<Probe />));
  return {
    client,
    bag: () => {
      if (latest === null) throw new Error("hook not rendered yet");
      return latest;
    },
  };
}

describe("useDocUpdates — the cursor", () => {
  it("starts at 0, sends ?since=, and advances past the rows it received", async () => {
    const seen: (string | null)[] = [];
    let call = 0;
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("since"));
        call += 1;
        return HttpResponse.json(
          call === 1
            ? { head_seq: 3, updates: [row(2), row(3)] }
            : { head_seq: 3, updates: [] }
        );
      })
    );
    const batches: number[][] = [];
    const { bag } = mountPoll({
      intervalMs: 40,
      onUpdates: (rows) => batches.push(rows.map((r) => r.seq)),
    });

    await waitFor(() => {
      expect(bag().since).toBe(3);
    });
    expect(bag().updates.map((r) => r.seq)).toEqual([2, 3]);
    expect(bag().headSeq).toBe(3);
    expect(batches).toEqual([[2, 3]]);
    expect(seen[0]).toBe("0");

    // The poll keeps going, and the next request carries the ADVANCED cursor.
    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(1);
    });
    expect(seen[1]).toBe("3");
    // An empty feed is not a batch: a consumer that applies rows must not be
    // woken by every tick that carried nothing.
    expect(batches).toEqual([[2, 3]]);
  });

  it("never delivers the same row twice, even if the wire repeats it", async () => {
    let call = 0;
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, () => {
        call += 1;
        // A backend (or a proxy) that treats `since` as inclusive.
        return HttpResponse.json(
          call === 1
            ? { head_seq: 2, updates: [row(1), row(2)] }
            : { head_seq: 3, updates: [row(2), row(3)] }
        );
      })
    );
    const { bag } = mountPoll({ intervalMs: 30 });

    await waitFor(() => {
      expect(bag().since).toBe(3);
    });
    expect(bag().updates.map((r) => r.seq)).toEqual([1, 2, 3]);
  });

  it("starts where the caller says (a client that just read a snapshot)", async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("since"));
        return HttpResponse.json({ head_seq: 12, updates: [] });
      })
    );
    const { bag } = mountPoll({ since: 12, intervalMs: 10_000 });
    await waitFor(() => {
      expect(seen[0]).toBe("12");
    });
    expect(bag().since).toBe(12);
  });

  it("clear() drops the buffer without rewinding the cursor; reset() does both", async () => {
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, () =>
        HttpResponse.json({ head_seq: 2, updates: [row(1), row(2)] })
      )
    );
    const { bag } = mountPoll({ intervalMs: 10_000 });
    await waitFor(() => {
      expect(bag().updates).toHaveLength(2);
    });

    act(() => {
      bag().clear();
    });
    expect(bag().updates).toHaveLength(0);
    expect(bag().since).toBe(2);

    act(() => {
      bag().reset(9);
    });
    expect(bag().since).toBe(9);
  });
});

describe("useDocUpdates — the resync order", () => {
  it("re-reads the content, drops the buffer, and re-arms at the new head", async () => {
    let updatesCalls = 0;
    let contentReads = 0;
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, ({ request }) => {
        updatesCalls += 1;
        const since = new URL(request.url).searchParams.get("since");
        if (updatesCalls === 1) {
          // The literal body `services.read_updates` → `present_resync` sends:
          // the requested seq aged out of the retained journal.
          return HttpResponse.json({ resync: true, head_seq: 41, snapshot_seq: 40 });
        }
        return HttpResponse.json({ head_seq: Number(since), updates: [] });
      }),
      http.get(`${BASE}/documents/d-1/content`, () => {
        contentReads += 1;
        return HttpResponse.text(`snapshot ${String(contentReads)}`, {
          headers: { "X-Docs-Head-Seq": "41" },
        });
      })
    );

    const resyncs: number[] = [];
    const { client, wrap } = harness();
    const seen: { bag: DocUpdatesBag | null } = { bag: null };
    function Probe(): ReactElement {
      seen.bag = useDocUpdates("d-1", {
        intervalMs: 40,
        onResync: (order) => resyncs.push(order.head_seq),
      });
      const content = useDocumentContent("d-1");
      return <span data-testid="content">{content.data?.text ?? "…"}</span>;
    }
    render(wrap(<Probe />));

    // The content read the resync invalidates has to exist first.
    await screen.findByText("snapshot 1");
    await waitFor(() => {
      expect(resyncs).toEqual([41]);
    });
    // The cursor is re-armed at the head the backend named — NOT left at 0,
    // which would order a resync again on the very next tick.
    await waitFor(() => {
      expect(seen.bag?.since).toBe(41);
    });
    expect(seen.bag?.updates).toHaveLength(0);
    expect(seen.bag?.resyncCount).toBe(1);

    // The content query was invalidated, so the snapshot was re-read.
    await waitFor(() => {
      expect(contentReads).toBeGreaterThan(1);
    });
    expect(
      client.getQueryState(docsQueryKeys.content("d-1"))?.dataUpdatedAt
    ).toBeGreaterThan(0);
  });
});

describe("useDocUpdates — when it must NOT poll", () => {
  it("is inert while disabled (a snapshot document, or a closed one)", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, () => {
        calls += 1;
        return HttpResponse.json({ head_seq: 1, updates: [] });
      })
    );
    const { bag } = mountPoll({ enabled: false, intervalMs: 10 });
    expect(bag().isPolling).toBe(false);
    // Long enough for several ticks to have happened if it were armed.
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(calls).toBe(0);
    expect(bag().since).toBe(0);
  });

  it("declares a sane default tempo rather than hammering the journal", () => {
    expect(DOC_UPDATES_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
    expect(DOC_UPDATES_INTERVAL_MS).toBeLessThanOrEqual(5000);
  });

  it("keys the poll by document, without the moving cursor in the key", () => {
    expect(docsQueryKeys.updates("d-1")).toEqual(["docs", "updates", "d-1"]);
  });
});

describe("useAppendUpdates", () => {
  it("posts the batch and invalidates the document head, not the module root", async () => {
    let body: unknown = null;
    server.use(
      http.post(`${BASE}/documents/d-1/updates`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ head_seq: 8 });
      })
    );
    const { client, wrap } = harness();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let append: ReturnType<typeof useAppendUpdates> | null = null;
    function Probe(): ReactElement {
      append = useAppendUpdates("d-1");
      return <span />;
    }
    render(wrap(<Probe />));

    act(() => {
      append?.mutate({ updates: ["AQID"], client_id: "c-1" });
    });
    await waitFor(() => {
      expect(append?.data?.head_seq).toBe(8);
    });
    expect(body).toEqual({ updates: ["AQID"], client_id: "c-1" });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: docsQueryKeys.document("d-1"),
    });
    // Never the module root: an append happens as often as a person types.
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: docsQueryKeys.all });
  });
});
