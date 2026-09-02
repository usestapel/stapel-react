/**
 * `useDocStream` — ONE hook, TWO transports, one downstream shape.
 *
 * The socket half runs through the REAL path: `@stapel/realtime`'s
 * `browserSocketFactory`, `new WebSocket(url)`, and a server double
 * (`test/docsSocketServer.ts`) that reproduces `DocUpdatesConsumer` on the
 * pinned v0.7.0 wire rather than answering whatever the client hoped for.
 * The polling half is the existing `useDocUpdates` machinery, already pinned
 * by `test/docUpdates.test.tsx` — here it is exercised as the FALLBACK the
 * design promises: a null `socket_path`, a missing `<RealtimeProvider>`, and
 * a terminal close all land on the same poll, at the cursor the socket got to.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { RealtimeProvider } from "@stapel/realtime/react";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { useDocumentContent } from "../src/model/queries.js";
import {
  deriveDocsSocketOrigin,
  docStreamKey,
  docSocketPath,
  useDocStream,
} from "../src/model/stream.js";
import type { DocStreamBag, DocStreamEvent, DocStreamOptions } from "../src/model/stream.js";
import {
  DocsUpdatesServer,
  docUpdatePayload,
  installBrowserWebSocket,
} from "./docsSocketServer.js";
import type { BrowserWebSocketEnvironment } from "./docsSocketServer.js";

const BASE = "https://docs.stapel.test/docs/api/v1";
const STREAM = docStreamKey("d-1");
const SOCKET_URL = "wss://docs.stapel.test/ws/docs/d-1";

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
  socket_path: "ws/docs/d-1" as string | null,
  created_at: "2026-09-01T09:00:00Z",
  updated_at: "2026-09-01T09:05:00Z",
  deleted_at: null,
  is_starred: false,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let env: BrowserWebSocketEnvironment;
beforeEach(() => {
  env = installBrowserWebSocket();
});
afterEach(() => {
  env.restore();
});

function documentRoute(socketPath: string | null): void {
  server.use(
    http.get(`${BASE}/documents/d-1`, () =>
      HttpResponse.json({ ...DOC, socket_path: socketPath })
    )
  );
}

interface Mounted {
  readonly client: QueryClient;
  readonly bag: () => DocStreamBag;
  readonly events: DocStreamEvent[];
  readonly resyncs: number[];
}

function mount(
  options: DocStreamOptions = {},
  wire: { readonly provider?: boolean; readonly contentProbe?: boolean } = {}
): Mounted {
  const runtime: DocsRuntime = createDocsRuntime({ baseUrl: BASE });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const events: DocStreamEvent[] = [];
  const resyncs: number[] = [];
  let latest: DocStreamBag | null = null;

  function Probe(): ReactElement {
    latest = useDocStream("d-1", {
      ...options,
      onEvents: (batch) => {
        events.push(...batch);
        options.onEvents?.(batch);
      },
      onResync: () => {
        resyncs.push(latest?.resyncCount ?? -1);
        options.onResync?.();
      },
    });
    // Enabled only where a test wires the /content route (an empty id keeps
    // the query off — msw runs with onUnhandledRequest: "error").
    const content = useDocumentContent(wire.contentProbe === true ? "d-1" : "");
    return (
      <>
        <span data-testid="transport">{latest.transport}</span>
        {wire.contentProbe === true ? (
          <span data-testid="content">{content.data?.text ?? "…"}</span>
        ) : null}
      </>
    );
  }

  const inner = (
    <QueryClientProvider client={client}>
      <DocsProvider runtime={runtime}>
        <Probe />
      </DocsProvider>
    </QueryClientProvider>
  );
  render(
    (wire.provider ?? true) ? (
      <RealtimeProvider
        url={(stream) => `wss://docs.stapel.test/${stream}`}
        session={null}
        random={() => 0.5}
      >
        {inner}
      </RealtimeProvider>
    ) : (
      inner
    )
  );
  return {
    client,
    bag: () => {
      if (latest === null) throw new Error("hook not rendered yet");
      return latest;
    },
    events,
    resyncs,
  };
}

async function connected(maxReplay?: number): Promise<DocsUpdatesServer> {
  await waitFor(() => expect(env.sockets.length).toBeGreaterThan(0));
  return new DocsUpdatesServer(env.last(), {
    stream: STREAM,
    ...(maxReplay !== undefined ? { maxReplay } : {}),
  });
}

describe("the stream key and socket address derivation", () => {
  it("mirrors stapel_docs.realtime verbatim", () => {
    expect(docStreamKey("7ad1c0de")).toBe("docs:doc:7ad1c0de");
    expect(docSocketPath("7ad1c0de")).toBe("ws/docs/7ad1c0de");
    expect(deriveDocsSocketOrigin("https://docs.stapel.test/docs/api/v1/")).toBe(
      "wss://docs.stapel.test"
    );
    expect(deriveDocsSocketOrigin("http://localhost:8000/docs/api/v1/")).toBe(
      "ws://localhost:8000"
    );
  });
});

describe("the socket carries the stream", () => {
  it("resolves socket_path off the document row, resumes by seq, and hands out ordered events", async () => {
    documentRoute("ws/docs/d-1");
    const { bag, events } = mount();

    const consumer = await connected();
    expect(env.last().url).toBe(SOCKET_URL);
    consumer.fill(2);
    act(() => {
      consumer.accept();
    });
    expect(consumer.lastHelloCursor).toBe(0);

    await waitFor(() => expect(events.map((e) => e.seq)).toEqual([1, 2]));
    expect(events[0]).toEqual({
      seq: 1,
      update: btoa("u1"),
      authorId: "u-2",
      clientId: null,
    });
    expect(bag().transport).toBe("socket");
    expect(bag().since).toBe(2);

    act(() => {
      consumer.append("u3", { authorId: "u-9", clientId: "c-1" });
    });
    await waitFor(() => expect(bag().since).toBe(3));
    expect(events[2]).toEqual({
      seq: 3,
      update: btoa("u3"),
      authorId: "u-9",
      clientId: "c-1",
    });
  });

  it("hello carries the caller's cursor, so only the gap is replayed", async () => {
    documentRoute("ws/docs/d-1");
    const { events } = mount({ since: 5 });
    const consumer = await connected();
    consumer.fill(7);
    act(() => {
      consumer.accept();
    });
    expect(consumer.lastHelloCursor).toBe(5);
    await waitFor(() => expect(events.map((e) => e.seq)).toEqual([6, 7]));
  });

  it("never delivers a row at or below the cursor, even if the wire repeats it", async () => {
    documentRoute("ws/docs/d-1");
    const { bag, events } = mount();
    const consumer = await connected();
    consumer.fill(2);
    act(() => {
      consumer.accept();
    });
    await waitFor(() => expect(bag().since).toBe(2));

    act(() => {
      // The fan-out's replay/live overlap: the same row, again.
      consumer.deliverLive(2, docUpdatePayload({ update: "u2", authorId: "u-2" }));
      consumer.deliverLive(3, docUpdatePayload({ update: "u3", authorId: "u-2" }));
    });
    await waitFor(() => expect(bag().since).toBe(3));
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it("a resync verdict re-reads the content, re-arms at the server tip, and signals", async () => {
    documentRoute("ws/docs/d-1");
    let contentReads = 0;
    server.use(
      http.get(`${BASE}/documents/d-1/content`, () => {
        contentReads += 1;
        return HttpResponse.text(`snapshot ${String(contentReads)}`, {
          headers: { "X-Docs-Head-Seq": "10" },
        });
      })
    );
    const { bag, resyncs } = mount({}, { contentProbe: true });
    await screen.findByText("snapshot 1");

    const consumer = await connected(5);
    consumer.fill(10);
    act(() => {
      consumer.accept();
    });

    await waitFor(() => expect(bag().resyncCount).toBe(1));
    expect(resyncs).toHaveLength(1);
    // Re-armed at the tip the server named — not left at 0 to resync forever.
    expect(bag().since).toBe(10);
    await waitFor(() => expect(contentReads).toBeGreaterThan(1));
  });
});

describe("polling is the floor every deployment reaches", () => {
  it("socket_path null → the ?since= poll, no WebSocket ever constructed", async () => {
    documentRoute(null);
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("since"));
        return HttpResponse.json({
          head_seq: 2,
          updates: [
            { seq: 1, payload: btoa("u1"), author_id: "u-2", created_at: "2026-09-01T10:00:00Z" },
            { seq: 2, payload: btoa("u2"), author_id: null, created_at: "2026-09-01T10:00:01Z" },
          ],
        });
      })
    );
    const { bag, events } = mount({ fallbackRefetchInterval: 40 });

    await waitFor(() => expect(bag().since).toBe(2));
    expect(bag().transport).toBe("polling");
    expect(env.sockets).toHaveLength(0);
    expect(seen[0]).toBe("0");
    expect(events).toEqual([
      { seq: 1, update: btoa("u1"), authorId: "u-2", clientId: null },
      { seq: 2, update: btoa("u2"), authorId: null, clientId: null },
    ]);
  });

  it("no <RealtimeProvider> is not a crash — it is the polling deployment", async () => {
    documentRoute("ws/docs/d-1");
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, () =>
        HttpResponse.json({
          head_seq: 1,
          updates: [
            { seq: 1, payload: btoa("u1"), author_id: null, created_at: "2026-09-01T10:00:00Z" },
          ],
        })
      )
    );
    const { bag } = mount({ fallbackRefetchInterval: 40 }, { provider: false });
    await waitFor(() => expect(bag().since).toBe(1));
    expect(bag().transport).toBe("polling");
    expect(env.sockets).toHaveLength(0);
  });

  it("a terminal close hands the stream to the poll AT THE SOCKET'S CURSOR", async () => {
    documentRoute("ws/docs/d-1");
    const polled: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/documents/d-1/updates`, ({ request }) => {
        polled.push(new URL(request.url).searchParams.get("since"));
        return HttpResponse.json({
          head_seq: 3,
          updates: [
            { seq: 3, payload: btoa("u3"), author_id: null, created_at: "2026-09-01T10:00:02Z" },
          ],
        });
      })
    );
    const { bag, events } = mount({ fallbackRefetchInterval: 40 });
    const consumer = await connected();
    consumer.fill(2);
    act(() => {
      consumer.accept();
    });
    await waitFor(() => expect(bag().since).toBe(2));
    expect(bag().transport).toBe("socket");

    act(() => {
      // 4403 on an ACCEPTED socket: authorize() said no. Terminal by canon.
      env.last().serverClose(4403, "forbidden");
    });

    await waitFor(() => expect(bag().transport).toBe("polling"));
    await waitFor(() => expect(bag().since).toBe(3));
    // The poll resumed where the socket left off — never from zero.
    expect(polled[0]).toBe("2");
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
  });
});
