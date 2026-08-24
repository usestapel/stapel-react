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

function harness(session: RealtimeSessionSeam | null) {
  const transport = fakeTransport();
  const clock = manualClock();
  const client = createRealtimeClient({
    url: "wss://api.example.test/ws/chat/7",
    webSocket: transport.factory,
    schedule: clock.schedule,
    random: () => 1,
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
