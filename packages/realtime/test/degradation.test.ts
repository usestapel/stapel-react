/**
 * Naming the silence.
 *
 * The failure these tests describe is not a bug in a socket — it is a
 * deployment that sits for months with a socket CONFIGURED and never once
 * usable, while the UI says "reconnecting…" and everyone reads that as a
 * network blip. A retry loop with no name is indistinguishable from a working
 * product with bad luck, so the runtime has to be able to say WHICH silence
 * this is: one that never worked, one that stopped working, or one the server
 * refused outright.
 *
 * Every clock here is virtual: the thresholds are assertions, not waits.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEVER_CONNECTED_ATTEMPTS,
  DEFAULT_NEVER_CONNECTED_MS,
  DEFAULT_RECONNECTING_LONG_MS,
  createRealtimeClient,
} from "../src/index.js";
import type { RealtimeClientOptions } from "../src/index.js";
import { FakeServer, STREAM, fakeTransport, manualClock } from "./fakeServer.js";

const URL = "wss://api.example.test/ws/chat/7";

function harness(overrides?: Partial<RealtimeClientOptions>) {
  const transport = fakeTransport();
  const clock = manualClock();
  const client = createRealtimeClient({
    url: URL,
    webSocket: transport.factory,
    schedule: clock.schedule,
    // A zero jitter draw floors at one tick, so a retry is one `advance(1)`
    // rather than a delay that would itself cross the threshold under test.
    random: () => 0,
    now: clock.now,
    session: null,
    ...overrides,
  });
  return { transport, clock, client };
}

describe("a socket that never becomes usable", () => {
  it("is named `never_connected` at the time threshold — no event required", () => {
    // THE case: the handshake is opened and simply never answered. No open, no
    // close, no error, ever. A purely event-driven client would sit in
    // `connecting` until the tab is closed, which is exactly the state a whole
    // product shipped in.
    const { transport, clock, client } = harness();
    const startedAt = clock.now();
    client.subscribe(STREAM);

    expect(transport.sockets).toHaveLength(1);
    expect(client.getState().everConnected).toBe(false);
    expect(client.getState().firstAttemptAt).toBe(startedAt);
    expect(client.getState().lastOpenAt).toBeUndefined();
    expect(client.getState().degradation).toBeNull();

    clock.advance(DEFAULT_NEVER_CONNECTED_MS - 1);
    expect(client.getState().degradation).toBeNull();

    clock.advance(1);
    expect(client.getState().degradation).toEqual({
      kind: "never_connected",
      since: startedAt,
      attempts: 0,
    });
    // Still not a refusal and still trying — "unavailable" is a description,
    // not a give-up.
    expect(client.getState().refused).toBe(false);
  });

  it("clears on the first open, and never comes back after one", () => {
    const { transport, clock, client } = harness();
    const startedAt = clock.now();
    const subscription = client.subscribe(STREAM);
    clock.advance(DEFAULT_NEVER_CONNECTED_MS);
    expect(client.getState().degradation?.kind).toBe("never_connected");

    const socket = transport.last();
    socket.accept();
    new FakeServer(socket).pump();

    expect(client.getState().degradation).toBeNull();
    expect(client.getState().everConnected).toBe(true);
    expect(client.getState().lastOpenAt).toBe(startedAt + DEFAULT_NEVER_CONNECTED_MS);
    expect(subscription.status().state).toBe("live");

    // It worked once, so a later outage is a RECONNECT — a different sentence
    // to a different person. Reporting "never connected" here would send an
    // operator to check an origin allowlist that is demonstrably correct.
    socket.serverClose(1006);
    clock.advance(DEFAULT_RECONNECTING_LONG_MS);
    expect(client.getState().degradation?.kind).toBe("reconnecting_long");
  });

  it("is named by failed attempts too, long before the time threshold", () => {
    const { transport, clock, client } = harness();
    const startedAt = clock.now();
    client.subscribe(STREAM);
    for (let attempt = 0; attempt < DEFAULT_NEVER_CONNECTED_ATTEMPTS; attempt += 1) {
      transport.last().serverClose(1006);
      clock.advance(1); // the retry, with the jitter draw pinned to its floor
    }
    const degradation = client.getState().degradation;
    expect(degradation).toEqual({
      kind: "never_connected",
      since: startedAt,
      attempts: DEFAULT_NEVER_CONNECTED_ATTEMPTS,
    });
    expect(clock.now() - startedAt).toBeLessThan(DEFAULT_NEVER_CONNECTED_MS);
  });

  it("honours configured thresholds", () => {
    const { clock, client } = harness({
      degradation: { neverConnectedMs: 5_000, neverConnectedAttempts: 99 },
    });
    client.subscribe(STREAM);
    clock.advance(4_999);
    expect(client.getState().degradation).toBeNull();
    clock.advance(1);
    expect(client.getState().degradation?.kind).toBe("never_connected");
  });

  it("says nothing at all while nothing is subscribed", () => {
    // An idle client is idle, not broken. A shell that renders "unavailable"
    // for a page that never opens a socket teaches people to ignore the badge.
    const { clock, client } = harness();
    clock.advance(DEFAULT_NEVER_CONNECTED_MS * 10);
    expect(client.getState().degradation).toBeNull();
    expect(client.getState().firstAttemptAt).toBeUndefined();
  });
});

describe("a drop that lasts", () => {
  it("is named `reconnecting_long`, timed from the drop and not from the open", () => {
    const { transport, clock, client } = harness();
    const socket = (): ReturnType<typeof transport.last> => transport.last();
    client.subscribe(STREAM);
    const openedAt = clock.now();
    socket().accept();
    const server = new FakeServer(socket());
    server.pump();

    // An hour of healthy uptime, heartbeat answered throughout. Timing the
    // outage from `lastOpenAt` would report this socket as an hour down the
    // instant it blinks.
    for (let elapsed = 0; elapsed < 3_600_000; elapsed += 25_000) {
      clock.advance(25_000);
      server.heartbeat();
    }
    expect(client.getState().connected).toBe(true);
    expect(client.getState().degradation).toBeNull();

    const droppedAt = clock.now();
    socket().serverClose(1006);
    expect(client.getState().reconnecting).toBe(true);
    expect(client.getState().degradation).toBeNull();

    clock.advance(DEFAULT_RECONNECTING_LONG_MS - 1);
    expect(client.getState().degradation).toBeNull();

    clock.advance(1);
    expect(client.getState().degradation).toEqual({
      kind: "reconnecting_long",
      since: droppedAt,
      attempts: 1,
    });
    expect(client.getState().everConnected).toBe(true);
    expect(client.getState().lastOpenAt).toBe(openedAt);
  });

  it("clears when the socket comes back", () => {
    const { transport, clock, client } = harness();
    client.subscribe(STREAM);
    transport.last().accept();
    new FakeServer(transport.last()).pump();
    transport.last().serverClose(1006);
    clock.advance(DEFAULT_RECONNECTING_LONG_MS);
    expect(client.getState().degradation?.kind).toBe("reconnecting_long");

    transport.last().accept();
    expect(client.getState().degradation).toBeNull();
    expect(client.getState().connected).toBe(true);
  });
});

describe("a refusal", () => {
  it("is named `refused` — the origin gate, with no countdown attached", () => {
    const { transport, clock, client } = harness();
    client.subscribe(STREAM);

    // Core's origin gate refuses in ASGI middleware, before `websocket.accept`.
    transport.last().serverClose(4403);
    clock.advance(1); // the single delayed retry an origin refusal is allowed
    transport.last().serverClose(4403);

    const state = client.getState();
    expect(state.refusal).toBe("origin");
    expect(state.everConnected).toBe(false);
    expect(state.degradation).toEqual({
      kind: "refused",
      since: clock.now(),
      attempts: 1,
      // No close reason from the gate, so the refusal kind IS the words — an
      // operator has to be able to tell `origin` from `forbidden` on sight.
      reason: "origin",
    });

    // A verdict outranks the never-connected clock: waiting changes nothing,
    // and a timer left running behind a refusal is how one came to look like
    // it was still trying.
    clock.advance(DEFAULT_NEVER_CONNECTED_MS * 5);
    expect(client.getState().degradation?.kind).toBe("refused");
    expect(clock.pending.filter((task) => !task.cancelled)).toHaveLength(0);
  });

  it("carries the server's own words when it gave any", () => {
    const { transport, client } = harness();
    client.subscribe(STREAM);
    const socket = transport.last();
    socket.accept();
    new FakeServer(socket).pump();
    socket.serverClose(4410, "removed_from_conversation");
    expect(client.getState().degradation).toMatchObject({
      kind: "refused",
      reason: "removed_from_conversation",
    });
  });

  it("gives way again when the retry button is pressed", () => {
    const { transport, client } = harness();
    client.subscribe(STREAM);
    transport.last().serverClose(4404);
    expect(client.getState().degradation?.kind).toBe("refused");

    client.reconnect();
    transport.last().accept();
    expect(client.getState().degradation).toBeNull();
    expect(client.getState().refused).toBe(false);
  });
});

describe("history survives a teardown", () => {
  it("does not re-accuse a working deployment after StrictMode's remount", () => {
    // close() is a teardown, not a tombstone. A client that forgot it had ever
    // been open would report `never_connected` on every dev-mode remount.
    const { transport, clock, client } = harness();
    client.subscribe(STREAM);
    transport.last().accept();
    client.close();
    expect(client.getState().degradation).toBeNull();
    expect(client.getState().everConnected).toBe(true);

    client.subscribe(STREAM);
    clock.advance(DEFAULT_NEVER_CONNECTED_MS + 1);
    // Past the never-connected threshold and deliberately silent about it: the
    // socket HAS connected here, so the only honest name is the outage one,
    // which is on its own longer clock.
    expect(client.getState().degradation).toBeNull();
    clock.advance(DEFAULT_RECONNECTING_LONG_MS);
    expect(client.getState().degradation?.kind).toBe("reconnecting_long");
  });
});
