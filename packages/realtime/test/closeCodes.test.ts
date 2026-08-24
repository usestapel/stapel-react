/**
 * Close codes: the fleet table, and the three answers a client may give.
 */
import { describe, expect, it, vi } from "vitest";
import {
  CLOSE_CODE_NAMES,
  DEFAULT_MAX_DELAY_MS,
  TERMINAL_CLOSE_CODES,
  backoffDelay,
  closeCodeName,
  closeDisposition,
  createRealtimeClient,
} from "../src/index.js";
import { FakeServer, STREAM, fakeTransport, manualClock } from "./fakeServer.js";

function harness() {
  const transport = fakeTransport();
  const clock = manualClock();
  const client = createRealtimeClient({
    url: "wss://api.example.test/ws/chat/7",
    webSocket: transport.factory,
    schedule: clock.schedule,
    random: () => 1,
    session: null,
  });
  const subscription = client.subscribe(STREAM);
  const socket = transport.last();
  socket.accept();
  new FakeServer(socket).pump();
  return { transport, clock, client, subscription, socket };
}

describe("the close-code table", () => {
  it("mirrors close_codes.py, names and all", () => {
    expect(CLOSE_CODE_NAMES).toEqual({
      4400: "protocol_error",
      4401: "unauthenticated",
      4403: "forbidden",
      4404: "stream_unknown",
      4408: "heartbeat_timeout",
      4410: "revoked",
      4413: "overflow",
      4503: "data_home_unavailable",
    });
    expect(closeCodeName(4999)).toBe("unknown");
  });

  it("keeps 4401 OUT of the terminal set — that was the whole defect", () => {
    // close_codes.py:70-72
    expect([...TERMINAL_CLOSE_CODES].sort()).toEqual([4403, 4404, 4410]);
    expect(TERMINAL_CLOSE_CODES.has(4401)).toBe(false);
    expect(closeDisposition(4401)).toBe("reauthenticate");
  });

  it.each([
    [4403, "terminal"],
    [4404, "terminal"],
    [4410, "terminal"],
    [4400, "reconnect"],
    [4408, "reconnect"],
    [4413, "reconnect"],
    [4503, "reconnect"],
    [1006, "reconnect"],
    [1012, "reconnect"],
  ])("disposition of %i is %s", (code, expected) => {
    expect(closeDisposition(code)).toBe(expected);
  });
});

describe("what the runtime does with them", () => {
  it("4403 on an ACCEPTED socket is a per-stream `authorize()` verdict", () => {
    const h = harness();
    h.socket.serverClose(4403);
    expect(h.subscription.status().state).toBe("refused");
    expect(h.subscription.status().refusal).toBe("forbidden");
    expect(h.clock.pending.filter((t) => !t.cancelled)).toHaveLength(0);
    expect(h.transport.sockets).toHaveLength(1);
    expect(h.client.getState().refused).toBe(true);
  });

  it("4403 after `error{unauthorized}` is still `forbidden`, not the origin gate", () => {
    // The substrate's re-authorize denial: `error{code=unauthorized}` then a
    // drained close 4403 (consumers.py:211-216).
    const h = harness();
    h.socket.deliver({
      v: 1,
      type: "error",
      stream: STREAM,
      payload: { code: "unauthorized", message: "no longer authorized for this stream" },
    });
    h.socket.serverClose(4403);
    expect(h.subscription.status().refusal).toBe("forbidden");
  });

  it("4403 BEFORE the handshake is accepted is the origin gate, not a permission", () => {
    // stapel_core.django.jwt.channels refuses a cookie handshake from an
    // unlisted origin in ASGI middleware, before websocket.accept — so the
    // socket never opens. That is a deployment misconfiguration, identical for
    // every user, and must not read as "you are not allowed in here".
    const transport = fakeTransport();
    const clock = manualClock();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/chat/7",
      webSocket: transport.factory,
      schedule: clock.schedule,
      random: () => 1,
      session: null,
    });
    const subscription = client.subscribe(STREAM);
    transport.last().serverClose(4403);

    // ONE delayed retry — an allowlist mid-rollout can be right a moment later.
    expect(subscription.status().state).toBe("reconnecting");
    clock.runNext();
    expect(transport.sockets).toHaveLength(2);

    // Then it holds. Hammering a host over its own config helps nobody, and
    // the operator has to SEE the refusal to go and fix it.
    transport.last().serverClose(4403);
    expect(subscription.status().state).toBe("refused");
    expect(subscription.status().refusal).toBe("origin");
    expect(clock.pending.filter((t) => !t.cancelled)).toHaveLength(0);
    expect(transport.sockets).toHaveLength(2);
  });

  it("never spends a session refresh on an origin refusal", () => {
    const refresh = vi.fn(async () => true);
    const transport = fakeTransport();
    const clock = manualClock();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/chat/7",
      webSocket: transport.factory,
      schedule: clock.schedule,
      random: () => 1,
      session: { refresh },
    });
    client.subscribe(STREAM);
    transport.last().serverClose(4403);
    clock.runNext();
    transport.last().serverClose(4403);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("4404 refuses too — an unknown stream will not become known by retrying", () => {
    const h = harness();
    h.socket.serverClose(4404);
    expect(h.subscription.status().refusal).toBe("stream_unknown");
  });

  it("4410 refuses with `revoked`", () => {
    const h = harness();
    h.socket.serverClose(4410);
    expect(h.subscription.status().refusal).toBe("revoked");
  });

  it.each([1006, 1012, 4408, 4413])("%i reconnects with backoff", (code) => {
    const h = harness();
    h.socket.serverClose(code);
    expect(h.subscription.status().state).toBe("reconnecting");
    expect(h.client.getState().reconnecting).toBe(true);
    h.clock.runNext();
    expect(h.transport.sockets).toHaveLength(2);
  });

  it("keeps retrying — there is no budget that runs out into silence", () => {
    const h = harness();
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      h.transport.last().serverClose(1006);
      expect(h.subscription.status().state).toBe("reconnecting");
      h.clock.runNext();
      h.transport.last().accept();
    }
    expect(h.transport.sockets).toHaveLength(13);
    expect(h.client.getState().refused).toBe(false);
  });

  it("resets the backoff on `welcome`, not on the socket opening", () => {
    const h = harness();
    h.socket.serverClose(1006);
    const firstDelay = h.clock.runNext();
    const second = h.transport.last();
    // Accepted, then refused mid-protocol: the handshake proved nothing.
    second.accept();
    second.serverClose(1006);
    const secondDelay = h.clock.runNext();
    expect(secondDelay).toBeGreaterThan(firstDelay);

    const third = h.transport.last();
    third.accept();
    new FakeServer(third).pump(); // → welcome
    expect(h.subscription.status().attempt).toBe(0);
  });
});

describe("backoff", () => {
  it("is exponential, capped, and fully jittered", () => {
    expect(backoffDelay(1, undefined, () => 1)).toBe(1_000);
    expect(backoffDelay(2, undefined, () => 1)).toBe(2_000);
    // 1000 * 2^5 = 32000, over the 30000 ceiling.
    expect(backoffDelay(6, undefined, () => 1)).toBe(DEFAULT_MAX_DELAY_MS);
    expect(backoffDelay(20, undefined, () => 1)).toBe(DEFAULT_MAX_DELAY_MS);
    // Full jitter: a uniform draw over the whole window, so a fleet of tabs
    // that dropped together does not come back as one wave.
    expect(backoffDelay(5, undefined, () => 0.25)).toBe(4_000);
    expect(backoffDelay(5, undefined, () => 0)).toBe(1);
  });
});
