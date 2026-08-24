/**
 * THE SEAM. The same screen, the same assertions, over both transports.
 *
 * Every test in this file is written once and run against a socket-backed
 * runtime and a polling one wherever the outcome must be identical — because
 * "the UI never knows which transport is active" is not a comment, it is a
 * property, and a property is something a test can hold.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { matchList } from "@stapel/core";
import { ConversationThread } from "../src/index.js";
import type { ChatRealtimeOptions } from "../src/index.js";
import { TestHarness, fakeTransport, mockServer } from "./harness.js";
import type { FakeTransport, MockServer } from "./harness.js";
import { CONVERSATION_ID, messageFrame, messagePage } from "./fixtures.js";

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
                  <li key={m.id} data-testid="row">
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

/**
 * The initial window is on screen. NOT `toEqual([1, 2, 3])`: with a 20 ms
 * refresh the tail (seq 4) can land before `waitFor`'s first 50 ms look, so
 * the exact intermediate state is a race the test must not depend on — it
 * did, and lost on a slow CI runner three tests in a row. The initial three
 * are the prefix either way; the tail is asserted separately where it
 * matters.
 */
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
        body: tailDelivered
          ? messagePage([4, 3, 2, 1])
          : messagePage([3, 2, 1]),
      };
    },
  });
}

const SOCKET_URL = "wss://chat.test/ws/chat/";

interface Mounted {
  readonly server: MockServer;
  readonly transport: FakeTransport | null;
}

function mount(options: { socket: boolean; intervalMs?: number }): Mounted {
  const server = threadServer();
  const transport = options.socket ? fakeTransport() : null;
  const realtime: ChatRealtimeOptions = transport
    ? { socketUrl: SOCKET_URL, webSocket: transport.factory }
    : { socketUrl: null };
  render(
    <TestHarness server={server} realtime={realtime}>
      <Thread {...(options.intervalMs !== undefined ? { intervalMs: options.intervalMs } : {})} />
    </TestHarness>
  );
  return { server, transport };
}

afterEach(() => {
  setVisibility("visible");
});

describe("the thread renders the same under either transport", () => {
  it("socket: replay window, then a live frame appends exactly once", async () => {
    const { server, transport } = mount({ socket: true, intervalMs: 0 });
    await waitFor(() => expect(rendered()).toEqual([1, 2, 3]));

    // The socket only opens once the window is loaded — with a real cursor.
    await waitFor(() => expect(transport?.sockets.length).toBe(1));
    act(() => transport?.last().open());
    expect(transport?.last().sent).toEqual([{ type: "hello", last_seq: 3 }]);
    expect(screen.getByTestId("transport").textContent).toBe("socket");

    act(() => {
      transport?.last().emit(messageFrame(4));
      // The fan-out delivers the same row to every subscriber, and a resume
      // overlaps replay with live: the screen must show it once.
      transport?.last().emit(messageFrame(4));
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

describe("a stopped socket never becomes a SILENT polling loop", () => {
  it("4403 stops the socket for good, keeps the thread fresh, and NAMES the degradation", async () => {
    const { server, transport } = mount({ socket: true, intervalMs: 20 });
    await initialWindowOnScreen();
    await waitFor(() => expect(transport?.sockets.length).toBe(1));

    act(() => transport?.last().serverClose(4403));

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
    expect(transport?.sockets).toHaveLength(1);
    await waitFor(() => expect(rendered()).toEqual([1, 2, 3, 4]));
    expect(server.calls.some((c) => c.url.includes("direction=prev"))).toBe(true);
  });

  it("4401 with nothing to renew asks the person to sign in, out loud", async () => {
    const { transport } = mount({ socket: true, intervalMs: 20 });
    await initialWindowOnScreen();
    await waitFor(() => expect(transport?.sockets.length).toBe(1));

    act(() => transport?.last().serverClose(4401));

    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("sign_in_required")
    );
    // The thread is still kept fresh — degrading is allowed. Doing it
    // wordlessly is not.
    expect(screen.getByTestId("transport").textContent).toBe("polling");
  });

  it("a deployment with no socket at all says so, rather than polling quietly", async () => {
    mount({ socket: false, intervalMs: 20 });
    await initialWindowOnScreen();
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("no_socket")
    );
  });

  it("a live socket reports no degradation", async () => {
    const { transport } = mount({ socket: true, intervalMs: 0 });
    await waitFor(() => expect(rendered()).toEqual([1, 2, 3]));
    await waitFor(() => expect(transport?.sockets.length).toBe(1));
    act(() => transport?.last().open());
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
    // The first page has been served; whether the screen still shows it or
    // already the failure arm (the tail 503s at once) is timing, not the
    // subject — the subject is how many attempts the next 250 ms cost.
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
