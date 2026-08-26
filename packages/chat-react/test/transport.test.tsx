/**
 * THE SEAM. The same screen, the same assertions, over both transports.
 *
 * Every test in this file is written once and run against a socket-backed
 * runtime and a polling one wherever the outcome must be identical — because
 * "the UI never knows which transport is active" is not a comment, it is a
 * property, and a property is something a test can hold.
 *
 * The socket half runs through the REAL path: `@stapel/realtime`'s
 * `browserSocketFactory`, `new WebSocket(url)`, and a server double
 * (`test/chatServer.ts`) that reproduces the consumer rather than answering
 * whatever the client hoped for. Nothing is injected where the constructor
 * stands — that is the seam whose bypass hid this pair's defect for months.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { matchList } from "@stapel/core";
import { ConversationThread, chatConversationStream } from "../src/index.js";
import type { ChatRealtimeOptions } from "../src/index.js";
import {
  ChatServer,
  TestHarness,
  chatMessagePayload,
  installBrowserWebSocket,
  mockServer,
} from "./harness.js";
import type { BrowserWebSocketEnvironment, MockServer } from "./harness.js";
import { CONVERSATION_ID, messagePage } from "./fixtures.js";

const STREAM = chatConversationStream(CONVERSATION_ID).key;
const SOCKET_ORIGIN = "wss://chat.test";

/** A thread screen with nothing in it but the list and its states. */
function Thread(props: { intervalMs?: number }): React.ReactElement {
  return (
    <ConversationThread
      conversationId={CONVERSATION_ID}
      {...(props.intervalMs !== undefined ? { refreshIntervalMs: props.intervalMs } : {})}
      autoMarkRead={false}
    >
      {({ state, transport, degraded }) => (
        <div>
          <span data-testid="transport">{transport}</span>
          <span data-testid="degraded">{degraded?.reason ?? "none"}</span>
          <span data-testid="degraded-key">{degraded?.messageKey ?? ""}</span>
          {matchList(state, {
            loading: () => <span data-testid="status">loading</span>,
            failed: () => <span data-testid="status">failed</span>,
            empty: () => <span data-testid="status">empty</span>,
            ready: (messages) => (
              <ul data-testid="status">
                {messages.map((m) => (
                  <li key={m.id} data-testid="row" data-body={m.body}>
                    {m.seq}
                  </li>
                ))}
              </ul>
            ),
          })}
        </div>
      )}
    </ConversationThread>
  );
}

/** seqs currently on screen, in render order. */
function rendered(): number[] {
  return screen.queryAllByTestId("row").map((node) => Number(node.textContent));
}

async function initialWindowOnScreen(): Promise<void> {
  await waitFor(() => expect(rendered().slice(0, 3)).toEqual([1, 2, 3]));
}

function threadServer(): MockServer {
  let tailDelivered = false;
  return mockServer({
    "GET /messages": (call) => {
      if (call.url.includes("direction=prev")) {
        tailDelivered = true;
        return { body: messagePage([4], { direction: "prev" }) };
      }
      return {
        body: tailDelivered ? messagePage([4, 3, 2, 1]) : messagePage([3, 2, 1]),
      };
    },
  });
}

let env: BrowserWebSocketEnvironment;
const retries: { fn: () => void; delay: number }[] = [];

beforeEach(() => {
  retries.length = 0;
  env = installBrowserWebSocket();
});

afterEach(() => {
  env.restore();
  setVisibility("visible");
});

interface Mounted {
  readonly server: MockServer;
}

function mount(options: { socket: boolean; intervalMs?: number }): Mounted {
  const server = threadServer();
  const realtime: ChatRealtimeOptions = options.socket
    ? {
        socketUrl: SOCKET_ORIGIN,
        // The substrate's OWN timer seam — not the socket's. A test that
        // wanted a reconnect to happen now would otherwise wait out a real
        // backoff, and one that wanted no reconnect could not prove it.
        schedule: (fn, delay) => {
          retries.push({ fn, delay });
          return () => {
            const index = retries.findIndex((entry) => entry.fn === fn);
            if (index >= 0) retries.splice(index, 1);
          };
        },
        random: () => 0.5,
      }
    : { socketUrl: null };
  render(
    <TestHarness server={server} realtime={realtime}>
      <Thread {...(options.intervalMs !== undefined ? { intervalMs: options.intervalMs } : {})} />
    </TestHarness>
  );
  return { server };
}

/** Wait for the pair to open its socket, then stand the consumer behind it. */
async function connected(): Promise<ChatServer> {
  await waitFor(() => expect(env.sockets.length).toBeGreaterThan(0));
  const server = new ChatServer(env.last(), { stream: STREAM });
  return server;
}

describe("the thread renders the same under either transport", () => {
  it("socket: the replay window resumes by rev_seq, and a live frame appends exactly once", async () => {
    const { server } = mount({ socket: true, intervalMs: 0 });
    await waitFor(() => expect(rendered()).toEqual([1, 2, 3]));

    // The socket only opens once the window is loaded — with a real cursor,
    // and the cursor is the REVISION seq, not the thread's.
    const consumer = await connected();
    expect(env.last().url).toBe(`${SOCKET_ORIGIN}/ws/chat/${CONVERSATION_ID}`);
    act(() => {
      consumer.accept();
    });
    expect(consumer.lastHelloCursor).toBe(3);
    expect(screen.getByTestId("transport").textContent).toBe("socket");

    act(() => {
      consumer.publish(chatMessagePayload({ seq: 4, conversationId: CONVERSATION_ID }));
      // The fan-out delivers the same row to every subscriber, and a resume
      // overlaps replay with live: the screen must show it once.
      consumer.publish(chatMessagePayload({ seq: 4, conversationId: CONVERSATION_ID }));
    });

    await waitFor(() => expect(rendered()).toEqual([1, 2, 3, 4]));
    // The frame said "there is something after your tip"; the store fetched
    // it BY SEQ rather than re-reading the whole thread.
    const tailCalls = server.calls.filter((c) => c.url.includes("direction=prev"));
    expect(tailCalls).toHaveLength(1);
    expect(tailCalls[0]?.url).toContain("anchor=3");
  });

  it("polling: no socket, same window, same tail-by-seq, same screen", async () => {
    const { server } = mount({ socket: false, intervalMs: 20 });
    await initialWindowOnScreen();
    expect(screen.getByTestId("transport").textContent).toBe("polling");

    await waitFor(() => expect(rendered()).toEqual([1, 2, 3, 4]));
    const tailCalls = server.calls.filter((c) => c.url.includes("direction=prev"));
    expect(tailCalls[0]?.url).toContain("anchor=3");
  });
});

describe("an edit is applied where no anchored refetch can reach it", () => {
  it("a revision frame rewrites the body in place, keeping the thread's order", async () => {
    mount({ socket: true, intervalMs: 0 });
    await waitFor(() => expect(rendered()).toEqual([1, 2, 3]));
    const consumer = await connected();
    act(() => {
      consumer.accept();
    });

    act(() => {
      consumer.publish(
        chatMessagePayload({
          seq: 2,
          revSeq: 4,
          conversationId: CONVERSATION_ID,
          body: "fixed a typo",
          edited: true,
        })
      );
    });

    await waitFor(() =>
      expect(
        screen.queryAllByTestId("row").map((node) => node.getAttribute("data-body"))
      ).toEqual(["message 1", "fixed a typo", "message 3"])
    );
    // Its place in the thread did not move — that is what happens when the
    // revision seq is mistaken for the ordering key.
    expect(rendered()).toEqual([1, 2, 3]);
  });
});

describe("a stopped socket never becomes a SILENT polling loop", () => {
  it("4403 on an accepted socket stops it for good, keeps the thread fresh, and NAMES the refusal", async () => {
    const { server } = mount({ socket: true, intervalMs: 20 });
    await initialWindowOnScreen();
    const consumer = await connected();
    act(() => {
      consumer.accept();
    });

    // `authorize()` said no for this stream — on a socket that WAS accepted,
    // which is what tells it apart from the origin gate.
    act(() => {
      env.last().serverClose(4403);
    });

    await waitFor(() =>
      expect(screen.getByTestId("transport").textContent).toBe("polling")
    );
    // …and the screen says WHY it is polling. `transport: "polling"` alone is
    // what a person read as "this product refreshes every few seconds" while
    // every handshake was being refused.
    expect(screen.getByTestId("degraded").textContent).toBe("forbidden");
    expect(screen.getByTestId("degraded-key").textContent).toBe(
      "chat.transport.degraded.forbidden"
    );
    // No second socket: the host already answered.
    expect(env.sockets).toHaveLength(1);
    await waitFor(() => expect(rendered()).toEqual([1, 2, 3, 4]));
    expect(server.calls.some((c) => c.url.includes("direction=prev"))).toBe(true);
  });

  it("4403 BEFORE the handshake is accepted is the deployment's origin allowlist, not this person's rights", async () => {
    mount({ socket: true, intervalMs: 20 });
    await initialWindowOnScreen();
    await connected();

    // Core's origin gate runs in ASGI middleware, before `websocket.accept`,
    // so the socket never opens. One delayed retry (an allowlist being rolled
    // out can be right a moment later), then it holds and SAYS so — an
    // operator has to see it to go and fix it.
    act(() => {
      env.last().serverClose(4403);
    });
    await waitFor(() => expect(retries.length).toBeGreaterThan(0));
    act(() => {
      retries.shift()?.fn();
    });
    act(() => {
      env.last().serverClose(4403);
    });

    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("origin_not_allowed")
    );
    expect(screen.getByTestId("degraded-key").textContent).toBe(
      "chat.transport.degraded.origin_not_allowed"
    );
  });

  it("a deployment with no socket at all says so, rather than polling quietly", async () => {
    mount({ socket: false, intervalMs: 20 });
    await initialWindowOnScreen();
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("no_socket")
    );
    expect(env.sockets).toHaveLength(0);
  });

  it("a live socket reports no degradation", async () => {
    mount({ socket: true, intervalMs: 0 });
    await waitFor(() => expect(rendered()).toEqual([1, 2, 3]));
    const consumer = await connected();
    act(() => {
      consumer.accept();
    });
    expect(screen.getByTestId("degraded").textContent).toBe("none");
  });
});

describe("a hole is healed, never rendered", () => {
  it("a truncated tail re-reads the newest window instead of stitching", async () => {
    // The tail page reports `has_prev`: more arrived above the anchor than
    // one page holds. The store must NOT append it onto seq 3.
    const server = mockServer({
      "GET /messages": (call) =>
        call.url.includes("direction=prev")
          ? { body: messagePage([9, 10], { direction: "prev", has_prev: true }) }
          : { body: messagePage([10, 9, 8], { has_next: true, next_anchor: "8" }) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <Thread intervalMs={20} />
      </TestHarness>
    );
    await waitFor(() => expect(rendered()).toEqual([8, 9, 10]));
    // Several polls later the window is still the contiguous newest page —
    // never 3 followed by 9.
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(rendered()).toEqual([8, 9, 10]);
  });
});

describe("polling is visibility-aware and backs off", () => {
  it("stops while the tab is hidden and catches up when it returns", async () => {
    const { server } = mount({ socket: false, intervalMs: 20 });
    await initialWindowOnScreen();

    setVisibility("hidden");
    const afterHide = server.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(server.calls.length).toBe(afterHide);

    setVisibility("visible");
    // Coming back is the moment the reader most wants the truth: a catch-up
    // fires immediately, without waiting out an interval.
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(afterHide));
  });

  it("backs off exponentially while the reads keep failing", async () => {
    const server = mockServer({
      "GET /messages": (call) =>
        call.url.includes("direction=prev")
          ? { status: 503, body: { localizable_error: "error.500.internal" } }
          : { body: messagePage([3, 2, 1]) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <Thread intervalMs={10} />
      </TestHarness>
    );
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0));
    const start = server.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 250));
    const attempts = server.calls.length - start;
    // Without backoff a 10 ms period would fire ~25 times in that window.
    expect(attempts).toBeGreaterThan(0);
    expect(attempts).toBeLessThan(10);
  });
});

/** jsdom's visibilityState is read-only; redefine it and fire the event. */
function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}
