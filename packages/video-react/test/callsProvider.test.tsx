/**
 * The global ring, driven the way the app drives it.
 *
 * Four properties, and every one of them is a way the feature fails while
 * looking like it works:
 *
 *  - a call reaches a page that is not the thread;
 *  - a socket that came back re-reads, so a frame lost while it was away does
 *    not leave a phantom ring or a silent one;
 *  - the ring ends on the SERVER's deadline, without waiting for a frame;
 *  - exactly one tab makes a sound, and a verdict anywhere dismisses the rest.
 *
 * The wire is mocked; nothing else is. Every response below is the body
 * stapel-video actually sends, with its own field names.
 */
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { CallsProvider, useCalls } from "../src/index.js";
import type { CallFrameLike } from "../src/index.js";
import type { CallTabBus, CallTabMessage } from "../src/index.js";
import { IncomingCallOverlay } from "../src/default/IncomingCallOverlay.js";
import { TestProviders, mockServer } from "./harness.js";
import type { HandlerResult, MockServer } from "./harness.js";

const ALICE = "u-alice";
const BOB = "u-bob";

function ringingCall(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: "call-1",
    thread_key: "conv-1",
    caller_id: ALICE,
    callee_id: BOB,
    room_name: "call-call-1",
    media: "video",
    state: "ringing",
    end_reason: "",
    started_at: new Date(Date.now() - 1000).toISOString(),
    answered_at: null,
    ended_at: null,
    duration_seconds: 0,
    expires_at: new Date(Date.now() + 44_000).toISOString(),
    ...overrides,
  };
}

const NO_CALL: HandlerResult = { body: { call: null } };

/** A bus a test drives by hand, standing in for BroadcastChannel. */
function fakeBus(): {
  open: (onMessage: (m: CallTabMessage) => void) => CallTabBus;
  posted: CallTabMessage[];
  deliver: (m: CallTabMessage) => void;
} {
  const posted: CallTabMessage[] = [];
  let listener: ((m: CallTabMessage) => void) | undefined;
  return {
    posted,
    deliver: (m) => {
      listener?.(m);
    },
    open: (onMessage) => {
      listener = onMessage;
      return {
        id: "tab-under-test",
        post: (m) => posted.push(m),
        close: () => {
          listener = undefined;
        },
      };
    },
  };
}

function Probe(): ReactElement {
  const calls = useCalls();
  return (
    <div>
      <span data-testid="probe-state">{calls.call?.state ?? "none"}</span>
      <span data-testid="probe-incoming">{String(calls.incoming)}</span>
      <span data-testid="probe-outgoing">{String(calls.outgoing)}</span>
      <span data-testid="probe-aloud">{String(calls.ringsAloud)}</span>
    </div>
  );
}

function mount(
  server: MockServer,
  options: {
    userId?: string;
    subscribe?: Parameters<typeof CallsProvider>[0]["subscribe"];
    openBus?: Parameters<typeof CallsProvider>[0]["openBus"];
    children?: ReactElement;
  } = {}
): void {
  render(
    <TestProviders server={server}>
      <CallsProvider
        userId={options.userId ?? BOB}
        notifyWhenHidden={false}
        {...(options.subscribe !== undefined ? { subscribe: options.subscribe } : {})}
        {...(options.openBus !== undefined ? { openBus: options.openBus } : {})}
      >
        <Probe />
        {options.children}
      </CallsProvider>
    </TestProviders>
  );
}

describe("the ring reaches a page that is not the thread", () => {
  it("shows an incoming call from the active-call read alone", async () => {
    // No socket at all — a REST-only host still receives calls. The provider
    // is mounted at the app root, so nothing about this depends on which
    // screen the person is looking at.
    const server = mockServer({ "GET /calls/active": { body: { call: ringingCall() } } });
    mount(server);
    await waitFor(() => {
      expect(screen.getByTestId("probe-incoming").textContent).toBe("true");
    });
    expect(screen.getByTestId("probe-outgoing").textContent).toBe("false");
  });

  it("tells the CALLER's screen apart from the callee's", async () => {
    const server = mockServer({ "GET /calls/active": { body: { call: ringingCall() } } });
    mount(server, { userId: ALICE });
    await waitFor(() => {
      expect(screen.getByTestId("probe-outgoing").textContent).toBe("true");
    });
    // One call, two screens: the caller gets the "calling" state with a
    // cancel, not an accept button for their own call.
    expect(screen.getByTestId("probe-incoming").textContent).toBe("false");
  });

  it("reports nothing when nothing is ringing", async () => {
    const server = mockServer({ "GET /calls/active": NO_CALL });
    mount(server);
    await waitFor(() => {
      expect(screen.getByTestId("probe-state").textContent).toBe("none");
    });
  });
});

describe("a socket that came back re-reads", () => {
  it("refetches /calls/active on reconnect", async () => {
    // THE repair. A frame lost while the socket was away is a call that never
    // rang or a ring that never stops; re-reading is what makes either a
    // two-second wrongness instead of a permanent one.
    let reconnect: (() => void) | undefined;
    const server = mockServer({ "GET /calls/active": NO_CALL });
    mount(server, {
      subscribe: ({ onReconnected }) => {
        reconnect = onReconnected;
        return () => undefined;
      },
    });
    await waitFor(() => {
      expect(screen.getByTestId("probe-state").textContent).toBe("none");
    });
    const before = server.calls.filter((c) => c.url.includes("/calls/active")).length;
    await act(async () => {
      reconnect?.();
    });
    await waitFor(() => {
      const after = server.calls.filter((c) => c.url.includes("/calls/active")).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it("re-reads on an incoming frame rather than building a call from it", async () => {
    // A frame carries six fields and the row carries thirteen. Synthesising
    // the rest would put a fabricated `state` on screen — and the re-read is
    // the same call that repairs a frame we never got, so it is one path.
    let deliver: ((frame: CallFrameLike) => void) | undefined;
    let answer: HandlerResult = NO_CALL;
    const server = mockServer({
      "GET /calls/active": () => answer,
    });
    mount(server, {
      subscribe: ({ onFrame }) => {
        deliver = onFrame;
        return () => undefined;
      },
    });
    await waitFor(() => {
      expect(screen.getByTestId("probe-state").textContent).toBe("none");
    });
    answer = { body: { call: ringingCall() } };
    await act(async () => {
      deliver?.({
        type: "call.incoming",
        payload: { call_id: "call-1", caller_id: ALICE },
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("probe-incoming").textContent).toBe("true");
    });
  });
});

describe("the ring ends on the server's deadline", () => {
  it("drops a call whose expires_at has already passed", async () => {
    // The frame is the CONFIRMATION, not the trigger. A client that waits for
    // `call.ended` shows a ring for a call that is over every time one is
    // dropped — and a dropped frame is the ordinary case for a Signal.
    const server = mockServer({
      "GET /calls/active": {
        body: {
          call: ringingCall({
            started_at: new Date(Date.now() - 90_000).toISOString(),
            expires_at: new Date(Date.now() - 45_000).toISOString(),
          }),
        },
      },
    });
    mount(server);
    await waitFor(() => {
      expect(screen.getByTestId("probe-state").textContent).toBe("none");
    });
    expect(screen.getByTestId("probe-incoming").textContent).toBe("false");
  });
});

describe("only one tab rings aloud", () => {
  it("claims the sound and tells the other tabs", async () => {
    const bus = fakeBus();
    const server = mockServer({ "GET /calls/active": { body: { call: ringingCall() } } });
    mount(server, { openBus: bus.open });
    await waitFor(() => {
      expect(screen.getByTestId("probe-aloud").textContent).toBe("true");
    });
    expect(bus.posted).toContainEqual({
      kind: "claim",
      callId: "call-1",
      from: "tab-under-test",
    });
  });

  it("goes quiet when another tab claimed it first", async () => {
    // Five tabs ringing at once is how a feature gets muted permanently. Every
    // tab still SHOWS the overlay — the call is real in all of them — and only
    // the sound is exclusive.
    const bus = fakeBus();
    const server = mockServer({ "GET /calls/active": { body: { call: ringingCall() } } });
    mount(server, { openBus: bus.open });
    await act(async () => {
      bus.deliver({ kind: "claim", callId: "call-1", from: "another-tab" });
    });
    await waitFor(() => {
      expect(screen.getByTestId("probe-incoming").textContent).toBe("true");
    });
    expect(screen.getByTestId("probe-aloud").textContent).toBe("false");
  });

  it("dismisses everywhere when one tab answers", async () => {
    const bus = fakeBus();
    const server = mockServer({ "GET /calls/active": { body: { call: ringingCall() } } });
    mount(server, { openBus: bus.open });
    await waitFor(() => {
      expect(screen.getByTestId("probe-incoming").textContent).toBe("true");
    });
    await act(async () => {
      bus.deliver({ kind: "resolved", callId: "call-1", from: "another-tab" });
    });
    await waitFor(() => {
      expect(screen.getByTestId("probe-incoming").textContent).toBe("false");
    });
  });
});

describe("the overlay", () => {
  it("draws the incoming state with accept and decline", async () => {
    const server = mockServer({ "GET /calls/active": { body: { call: ringingCall() } } });
    mount(server, { children: <IncomingCallOverlay /> });
    await waitFor(() => {
      expect(screen.getByTestId("video-ring-overlay")).toBeTruthy();
    });
    expect(screen.getByTestId("video-ring-accept")).toBeTruthy();
    expect(screen.getByTestId("video-ring-decline")).toBeTruthy();
  });

  it("draws the caller's cancel instead of an accept", async () => {
    const server = mockServer({ "GET /calls/active": { body: { call: ringingCall() } } });
    mount(server, { userId: ALICE, children: <IncomingCallOverlay /> });
    await waitFor(() => {
      expect(screen.getByTestId("video-ring-cancel")).toBeTruthy();
    });
    expect(screen.queryByTestId("video-ring-accept")).toBeNull();
  });

  it("renders nothing at all when no call is ringing", async () => {
    const server = mockServer({ "GET /calls/active": NO_CALL });
    mount(server, { children: <IncomingCallOverlay /> });
    await waitFor(() => {
      expect(screen.getByTestId("probe-state").textContent).toBe("none");
    });
    expect(screen.queryByTestId("video-ring-overlay")).toBeNull();
  });
});

describe("the provider is not optional", () => {
  it("throws rather than answering an idle state without one", () => {
    // A button that silently does nothing because somebody forgot the
    // provider looks exactly like "nobody is calling", which is the failure
    // this whole wave exists to prevent.
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/CallsProvider/u);
    quiet.mockRestore();
  });
});
