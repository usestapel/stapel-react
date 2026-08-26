/**
 * 4401 — the defect this package was built to close.
 *
 * The pre-substrate client read 4401 as terminal and stopped ("4401 closes for
 * good" was pinned by a test as CORRECT behaviour). In cookie mode 4401 means
 * the session needs refreshing, and the discipline is the HTTP one (§43.2):
 * single-flight refresh → ONE reconnect → still 4401 → `sessionLost()`, with a
 * refusal a person can actually see at the end of it. Never a silent fall back
 * to polling.
 */
import { describe, expect, it, vi } from "vitest";
import { createRealtimeClient } from "../src/index.js";
import type { RealtimeSessionSeam } from "../src/index.js";
import { FakeServer, STREAM, fakeTransport, manualClock } from "./fakeServer.js";

interface SessionDouble extends RealtimeSessionSeam {
  readonly refresh: ReturnType<typeof vi.fn>;
  readonly sessionLost: ReturnType<typeof vi.fn>;
  fireUnavailable(): void;
}

function sessionDouble(outcome: boolean | "unavailable"): SessionDouble {
  const handlers = new Set<(payload: unknown) => void>();
  const double: SessionDouble = {
    refresh: vi.fn(async () => {
      if (outcome === "unavailable") {
        double.fireUnavailable();
        return false;
      }
      return outcome;
    }),
    sessionLost: vi.fn(),
    on: (event, handler) => {
      if (event !== "session:refresh-unavailable") return () => undefined;
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    fireUnavailable: () => {
      for (const handler of handlers) handler(undefined);
    },
  };
  return double;
}

/**
 * A refresh that does not answer until the test says so — the only way to
 * observe the window between the question and the verdict, which is precisely
 * what `RealtimeState.refreshing` reports.
 */
interface DeferredSession extends SessionDouble {
  settle(outcome: boolean | "unavailable"): void;
}

function deferredSession(): DeferredSession {
  const handlers = new Set<(payload: unknown) => void>();
  let release: ((ok: boolean) => void) | null = null;
  const double: DeferredSession = {
    refresh: vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve;
        })
    ),
    sessionLost: vi.fn(),
    on: (event, handler) => {
      if (event !== "session:refresh-unavailable") return () => undefined;
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    fireUnavailable: () => {
      for (const handler of handlers) handler(undefined);
    },
    settle: (outcome) => {
      if (release === null) throw new Error("refresh() was never called");
      if (outcome === "unavailable") double.fireUnavailable();
      release(outcome === true);
    },
  };
  return double;
}

function harness(session: RealtimeSessionSeam | null) {
  const transport = fakeTransport();
  const clock = manualClock();
  const client = createRealtimeClient({
    url: "wss://api.example.test/ws/chat/7",
    webSocket: transport.factory,
    schedule: clock.schedule,
    random: () => 1,
    now: clock.now,
    session,
  });
  const subscription = client.subscribe(STREAM);
  const socket = transport.last();
  socket.accept();
  new FakeServer(socket).pump();
  return { transport, clock, client, subscription };
}

describe("4401", () => {
  it("refreshes the session and reconnects once, with no backoff wait", async () => {
    const session = sessionDouble(true);
    const h = harness(session);
    h.transport.last().serverClose(4401);
    await vi.waitFor(() => expect(h.transport.sockets).toHaveLength(2));

    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(session.sessionLost).not.toHaveBeenCalled();
    // No backoff timer was burned: the person is looking at the screen.
    expect(h.clock.pending.filter((t) => !t.cancelled)).toHaveLength(0);
    expect(h.subscription.status().state).toBe("reconnecting");

    const second = h.transport.last();
    second.accept();
    new FakeServer(second).pump();
    expect(h.subscription.status().state).toBe("live");
  });

  it("declares the session lost when 4401 survives the refresh", async () => {
    const session = sessionDouble(true);
    const h = harness(session);
    h.transport.last().serverClose(4401);
    await vi.waitFor(() => expect(h.transport.sockets).toHaveLength(2));
    // The fresh credential is refused too. That is a verdict, not a fault.
    h.transport.last().serverClose(4401);

    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(session.sessionLost).toHaveBeenCalledWith("expired");
    expect(h.subscription.status().state).toBe("refused");
    expect(h.subscription.status().refusal).toBe("session");
    expect(h.client.getState().refused).toBe(true);
    expect(h.transport.sockets).toHaveLength(2);
  });

  it("re-arms the one refresh after a welcome", async () => {
    const session = sessionDouble(true);
    const h = harness(session);
    h.transport.last().serverClose(4401);
    await vi.waitFor(() => expect(h.transport.sockets).toHaveLength(2));
    const second = h.transport.last();
    second.accept();
    new FakeServer(second).pump(); // welcome → the socket proved itself
    second.serverClose(4401);
    await vi.waitFor(() => expect(session.refresh).toHaveBeenCalledTimes(2));
    expect(session.sessionLost).not.toHaveBeenCalled();
  });

  it("backs off instead of signing the user out when the refresh got no verdict", async () => {
    // A 502 mid-deploy is not evidence that a credential is dead — core says
    // so on `session:refresh-unavailable`, and throwing the user out there is
    // a live incident this fleet has already had once.
    const session = sessionDouble("unavailable");
    const h = harness(session);
    h.transport.last().serverClose(4401);
    await vi.waitFor(() =>
      expect(h.subscription.status().state).toBe("reconnecting")
    );
    expect(session.sessionLost).not.toHaveBeenCalled();
    expect(h.client.getState().refused).toBe(false);
    h.clock.runNext();
    expect(h.transport.sockets).toHaveLength(2);
  });

  it("surfaces a visible refusal when there is no session seam to ask", () => {
    const h = harness(null);
    h.transport.last().serverClose(4401);
    expect(h.subscription.status().state).toBe("refused");
    expect(h.subscription.status().refusal).toBe("session");
  });

  it("comes back on an explicit reconnect after a refusal", () => {
    const h = harness(null);
    h.transport.last().serverClose(4401);
    expect(h.subscription.status().state).toBe("refused");
    h.client.reconnect();
    expect(h.transport.sockets).toHaveLength(2);
    // Not "connecting": this socket has been up before, and the indicator must
    // not read as a first connection.
    expect(h.subscription.status().state).toBe("reconnecting");
    expect(h.subscription.status().refusal).toBeUndefined();
  });
});

/**
 * The window between the question and the verdict.
 *
 * A 4401 that is being refreshed is not yet a broken socket and not yet a dead
 * session, and for the ~200 ms it takes a shell used to render it as one or the
 * other. `refreshing` names the question and NOTHING else: it is set on the way
 * into the single-flight refresh and cleared on the way out of it for all three
 * outcomes alike, so a skin can never read an answer out of it. The `state`
 * union is deliberately untouched — an extra member there breaks an exhaustive
 * switch in every consumer that already wrote one.
 */
describe("a session refresh in flight", () => {
  it("is published while the refresh is unanswered, stamped from the injected clock", () => {
    const session = deferredSession();
    const h = harness(session);
    h.clock.advance(5_000); // the socket ran for a while before the 4401
    const at = h.clock.now();
    h.transport.last().serverClose(4401);

    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(h.client.getState().refreshing).toEqual({ since: at });
    // It says "asking", never "answered": no outcome has been written
    // anywhere. The aggregate is `idle` here — the socket is gone and no retry
    // is armed yet, because what happens next depends on the refresh — which
    // is exactly the moment a shell had nothing honest to render before.
    expect(h.subscription.status().state).toBe("reconnecting");
    expect(h.client.getState().state).toBe("idle");
    expect(h.client.getState().refused).toBe(false);
  });

  it("clears when the session is renewed", async () => {
    const session = deferredSession();
    const h = harness(session);
    h.transport.last().serverClose(4401);
    expect(h.client.getState().refreshing).not.toBeNull();

    session.settle(true);
    await vi.waitFor(() => expect(h.transport.sockets).toHaveLength(2));
    expect(h.client.getState().refreshing).toBeNull();
  });

  it("clears when the refresh reached no verdict", async () => {
    const session = deferredSession();
    const h = harness(session);
    h.transport.last().serverClose(4401);
    expect(h.client.getState().refreshing).not.toBeNull();

    session.settle("unavailable");
    await vi.waitFor(() =>
      expect(h.subscription.status().state).toBe("reconnecting")
    );
    expect(h.client.getState().refreshing).toBeNull();
    expect(h.client.getState().refused).toBe(false);
  });

  it("clears when the refresh was refused", async () => {
    const session = deferredSession();
    const h = harness(session);
    h.transport.last().serverClose(4401);
    expect(h.client.getState().refreshing).not.toBeNull();

    session.settle(false);
    await vi.waitFor(() => expect(h.client.getState().refused).toBe(true));
    expect(h.client.getState().refreshing).toBeNull();
    expect(h.client.getState().refusal).toBe("session");
  });

  it("is never set when no refresh is spent", async () => {
    // An ordinary retryable close asks the session nothing.
    const backoff = harness(sessionDouble(true));
    backoff.transport.last().serverClose(4408);
    expect(backoff.client.getState().refreshing).toBeNull();

    // No seam to ask: a refusal, with no phantom refresh in front of it.
    const seamless = harness(null);
    seamless.transport.last().serverClose(4401);
    expect(seamless.client.getState().refreshing).toBeNull();

    // The second 4401 has no refresh left to arm — it is the HTTP path's
    // verdict, and a state that said "refreshing" there would be inventing one.
    const session = sessionDouble(true);
    const h = harness(session);
    h.transport.last().serverClose(4401);
    await vi.waitFor(() => expect(h.transport.sockets).toHaveLength(2));
    h.transport.last().serverClose(4401);
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(h.client.getState().refreshing).toBeNull();
    expect(h.client.getState().refusal).toBe("session");
  });
});
