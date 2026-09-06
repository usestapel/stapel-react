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
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { CallsProvider, useCalls } from "../src/index.js";
import type { CallFrameLike } from "../src/index.js";
import type { CallTabBus, CallTabMessage } from "../src/index.js";
import { CallRoute } from "../src/default/CallRoute.js";
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
      // Whose ring this is. The bus is per-ORIGIN and an origin is not a
      // person: two accounts on one browser share every message.
      user: BOB,
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

describe("a dismissal is about a RING, and about whose ring it is", () => {
  /**
   * The stand caught the whole failure in one timeline (walker defect D441):
   * a media session torn down 9 ms after "signal connected". Two mechanisms
   * behind it, both here.
   *
   * The cross-tab bus is scoped to the ORIGIN, and an origin is not a person:
   * the other party's page, on the same browser, dismissed its own incoming
   * call and this side dropped the LIVE one. And the `resolved` message was
   * honoured in any state, so a dismissal arriving after acceptance unmounted
   * a call that was connecting.
   */
  it("ignores a resolved message once the call is past ringing", async () => {
    const bus = fakeBus();
    const server = mockServer({
      "GET /calls/active": {
        body: {
          call: ringingCall({
            state: "accepted",
            answered_at: new Date().toISOString(),
          }),
        },
      },
    });
    mount(server, { openBus: bus.open });
    await waitFor(() => {
      expect(screen.getByTestId("probe-state").textContent).toBe("accepted");
    });
    await act(async () => {
      bus.deliver({
        kind: "resolved",
        callId: "call-1",
        from: "another-tab",
        user: BOB,
      });
    });
    // Still there: past the ring, what ends a call is the server saying so.
    expect(screen.getByTestId("probe-state").textContent).toBe("accepted");
  });

  it("still closes a RINGING call another tab dealt with", async () => {
    const bus = fakeBus();
    const server = mockServer({
      "GET /calls/active": { body: { call: ringingCall() } },
    });
    mount(server, { openBus: bus.open });
    await waitFor(() => {
      expect(screen.getByTestId("probe-incoming").textContent).toBe("true");
    });
    await act(async () => {
      bus.deliver({
        kind: "resolved",
        callId: "call-1",
        from: "another-tab",
        user: BOB,
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("probe-state").textContent).toBe("none");
    });
  });

  it("ignores a message about somebody ELSE's call on the same browser", async () => {
    const bus = fakeBus();
    const server = mockServer({
      "GET /calls/active": { body: { call: ringingCall() } },
    });
    mount(server, { openBus: bus.open });
    await waitFor(() => {
      expect(screen.getByTestId("probe-incoming").textContent).toBe("true");
    });
    await act(async () => {
      bus.deliver({
        kind: "resolved",
        callId: "call-1",
        from: "the-other-party-tab",
        user: ALICE,
      });
    });
    expect(screen.getByTestId("probe-state").textContent).toBe("ringing");
    expect(screen.getByTestId("probe-incoming").textContent).toBe("true");
  });

  it("treats a message with no user id as an older tab, not as a mismatch", async () => {
    const bus = fakeBus();
    const server = mockServer({
      "GET /calls/active": { body: { call: ringingCall() } },
    });
    mount(server, { openBus: bus.open });
    await waitFor(() => {
      expect(screen.getByTestId("probe-incoming").textContent).toBe("true");
    });
    await act(async () => {
      bus.deliver({ kind: "resolved", callId: "call-1", from: "old-tab" });
    });
    await waitFor(() => {
      expect(screen.getByTestId("probe-state").textContent).toBe("none");
    });
  });
});

describe("<CallRoute> hands the stage the loader it was given", () => {
  /**
   * The route MOUNTS the stage, so a host whose build must not see the
   * `livekit-client` specifier — or whose test drives the arms without the
   * SDK — had no way to reach the `loadPeer` seam at all: it existed on a
   * component nobody mounts.
   */
  it("forwards `loadPeer`, so the stage connects through the host's loader", async () => {
    const asked: string[] = [];
    class Room {
      connect = vi.fn().mockResolvedValue(undefined);
      disconnect = vi.fn();
    }
    // The grant arrives the way it does in life: the callee accepts, and the
    // accept answers with the token and the media server's address.
    let accepted = false;
    const server = mockServer({
      "GET /calls/active": () => ({
        body: {
          call: accepted
            ? ringingCall({
                state: "accepted",
                answered_at: new Date().toISOString(),
              })
            : ringingCall(),
        },
      }),
      // The accept answers with the CALL and this browser's own grant, which
      // is what makes the route mount.
      "POST /accept": () => {
        accepted = true;
        return {
          body: {
            call: ringingCall({
              state: "accepted",
              answered_at: new Date().toISOString(),
            }),
            token: "tok",
            url: "wss://sfu.test",
          },
        };
      },
    });
    render(
      <TestProviders server={server}>
        <CallsProvider userId={BOB} notifyWhenHidden={false}>
          <IncomingCallOverlay />
          <CallRoute
            loadPeer={async () => {
              asked.push("host loader");
              return { Room };
            }}
          />
        </CallsProvider>
      </TestProviders>
    );
    await waitFor(() => expect(screen.getByTestId("video-ring-accept")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByTestId("video-ring-accept"));
    });
    // The stage asked the HOST's loader, not the built-in import.
    await waitFor(() => {
      expect(asked).toEqual(["host loader"]);
    });
  });
});

/**
 * The in-call screen survives a frame that merely fails to confirm the call.
 *
 * `<CallRoute>` mounts `<CallStage>`, and unmounting the stage DISCONNECTS the
 * room. So every condition the route mounts on is a way to hang up a working
 * call by accident, and the route used to mount on a live conjunction
 * re-evaluated every render: an active-call read answering `{call: null}`
 * between two truths, or a sibling tab's `resolved` landing while this tab's
 * cached row still said `ringing`, tore down the media session mid-call — and
 * unrecoverably, because the same frame dropped the grant.
 *
 * Nothing below hand-shapes the state under test: the call is accepted through
 * the overlay, the grant comes back from `POST /accept` the way it does in
 * life, and the blips are the bodies `GET /calls/active` really answers.
 */
describe("<CallRoute> latches the media session by call id", () => {
  function acceptedCall(overrides: Record<string, unknown> = {}): unknown {
    return ringingCall({
      state: "accepted",
      answered_at: new Date().toISOString(),
      ...overrides,
    });
  }

  interface Session {
    readonly rooms: { disconnect: ReturnType<typeof vi.fn> }[];
    readonly frame: (f: CallFrameLike) => void;
    readonly bus: ReturnType<typeof fakeBus>;
  }

  /**
   * Ring, accept, and wait until the media session is up.
   *
   * `after` is what `GET /calls/active` answers ONCE THE CALL HAS BEEN
   * ACCEPTED — the phase each test is about. Before that it answers the ring,
   * because the grant has to arrive the way it does in life: out of
   * `POST /accept`, pressed on the overlay.
   */
  async function connectCall(
    after: () => HandlerResult,
    options: { autoPublish?: boolean } = {}
  ): Promise<Session> {
    const rooms: { disconnect: ReturnType<typeof vi.fn> }[] = [];
    class Room {
      connect = vi.fn().mockResolvedValue(undefined);
      disconnect = vi.fn();
      localParticipant = {
        setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
        setCameraEnabled: vi.fn().mockResolvedValue(undefined),
      };
      constructor() {
        rooms.push(this);
      }
    }
    let answered = false;
    let deliver: ((f: CallFrameLike) => void) | undefined;
    const bus = fakeBus();
    const server = mockServer({
      "GET /calls/active": () =>
        answered ? after() : { body: { call: ringingCall() } },
      "POST /accept": () => {
        answered = true;
        return {
          body: { call: acceptedCall(), token: "tok", url: "wss://sfu.test" },
        };
      },
      "POST /hangup": () => ({ body: { call: acceptedCall({ state: "ended" }) } }),
    });
    render(
      <TestProviders server={server}>
        <CallsProvider
          userId={BOB}
          notifyWhenHidden={false}
          openBus={bus.open}
          subscribe={({ onFrame }) => {
            deliver = onFrame;
            return () => {
              deliver = undefined;
            };
          }}
        >
          <IncomingCallOverlay />
          <CallRoute
            {...(options.autoPublish !== undefined
              ? { autoPublish: options.autoPublish }
              : {})}
            loadPeer={async () => ({ Room })}
          />
        </CallsProvider>
      </TestProviders>
    );
    await waitFor(() => expect(screen.getByTestId("video-ring-accept")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByTestId("video-ring-accept"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("video-stage-connected")).toBeTruthy()
    );
    return {
      rooms,
      bus,
      frame: (f) => {
        deliver?.(f);
      },
    };
  }

  it("holds the call through an active-call read that answers `{call: null}`", async () => {
    // The read is the module's own repair, and it races everything it repairs:
    // a request issued before the accept landed answers the world as it was.
    // One `null` is not an end.
    let blip = false;
    const session = await connectCall(() => {
      if (blip) {
        blip = false;
        return { body: { call: null } };
      }
      return { body: { call: acceptedCall() } };
    });
    blip = true;
    // A frame this pair acts on by RE-READING — the ordinary way a refetch
    // starts — rather than a test poking the query cache.
    await act(async () => {
      session.frame({ type: "call.accepted", payload: { call_id: "call-1" } });
    });
    await waitFor(() => {
      expect(screen.getByTestId("video-stage-connected")).toBeTruthy();
    });
    expect(session.rooms).toHaveLength(1);
    expect(session.rooms[0]?.disconnect).not.toHaveBeenCalled();
  });

  it("holds the call through a sibling tab's `resolved` during connect", async () => {
    // The accepting tab announces `resolved` and re-reads; a sibling's
    // dismissal can therefore land while this tab still holds the pre-accept
    // row. A browser holding the grant for that call is IN it, whatever a
    // stale row says.
    let stale = false;
    const session = await connectCall(() =>
      stale ? { body: { call: ringingCall() } } : { body: { call: acceptedCall() } }
    );
    stale = true;
    await act(async () => {
      session.bus.deliver({
        kind: "resolved",
        callId: "call-1",
        from: "another-tab-of-mine",
        user: BOB,
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("video-stage-connected")).toBeTruthy();
    });
    expect(session.rooms[0]?.disconnect).not.toHaveBeenCalled();
    // And the read that follows puts the row back without a second dial.
    stale = false;
    await act(async () => {
      session.frame({ type: "call.accepted", payload: { call_id: "call-1" } });
    });
    await waitFor(() => {
      expect(screen.getByTestId("video-stage-connected")).toBeTruthy();
    });
    expect(session.rooms).toHaveLength(1);
    expect(session.rooms[0]?.disconnect).not.toHaveBeenCalled();
  });

  it("closes on `call.ended` — the one frame that ends a session", async () => {
    let over = false;
    const session = await connectCall(() =>
      over ? { body: { call: null } } : { body: { call: acceptedCall() } }
    );
    over = true;
    await act(async () => {
      session.frame({
        type: "call.ended",
        payload: {
          call_id: "call-1",
          state: "ended",
          end_reason: "hangup",
          duration_seconds: 42,
        },
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId("video-call-route")).toBeNull();
    });
    expect(session.rooms[0]?.disconnect).toHaveBeenCalled();
  });

  it("ignores a `call.ended` about somebody else's call", async () => {
    const session = await connectCall(() => ({ body: { call: acceptedCall() } }));
    await act(async () => {
      session.frame({
        type: "call.ended",
        payload: { call_id: "call-9", state: "ended", end_reason: "hangup" },
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("video-stage-connected")).toBeTruthy();
    });
    expect(session.rooms[0]?.disconnect).not.toHaveBeenCalled();
  });

  it("forwards `autoPublish` to the panel it mounts", async () => {
    // The route mounts the panel, so a host that publishes from its own device
    // picker could set this on a `<CallPanel>` it never renders and had no way
    // to reach the one that is really on screen.
    const off = await connectCall(() => ({ body: { call: acceptedCall() } }), {
      autoPublish: false,
    });
    await waitFor(() => expect(screen.getByTestId("video-call-panel")).toBeTruthy());
    expect(
      (off.rooms[0] as unknown as {
        localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn> };
      }).localParticipant.setMicrophoneEnabled
    ).not.toHaveBeenCalled();
  });

  it("publishes on mount when the host says nothing", async () => {
    const on = await connectCall(() => ({ body: { call: acceptedCall() } }));
    await waitFor(() => {
      expect(
        (on.rooms[0] as unknown as {
          localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn> };
        }).localParticipant.setMicrophoneEnabled
      ).toHaveBeenCalledWith(true);
    });
  });
});
