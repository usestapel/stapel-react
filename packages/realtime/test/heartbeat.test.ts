/**
 * The heartbeat. The server pings every `HEARTBEAT_S` and closes 4408 if no
 * `pong` comes back inside `HEARTBEAT_TIMEOUT_S` — so a client that does not
 * answer loses its socket every 35 seconds and pays a full replay each time,
 * while looking, from the outside, like a working connection with a twitch.
 * The pre-substrate chat client had no `ping` case at all.
 */
import { describe, expect, it } from "vitest";
import { createRealtimeClient } from "../src/index.js";
import { FakeServer, STREAM, fakeTransport, manualClock } from "./fakeServer.js";

describe("heartbeat", () => {
  it("answers every server ping with a pong, so 4408 never fires", () => {
    const transport = fakeTransport();
    const clock = manualClock();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/chat/7",
      webSocket: transport.factory,
      schedule: clock.schedule,
      session: null,
    });
    const subscription = client.subscribe(STREAM);
    const socket = transport.last();
    const server = new FakeServer(socket);
    server.fill(1);
    socket.accept();
    server.pump();

    for (let tick = 0; tick < 3; tick += 1) server.heartbeat();

    expect(socket.receivedOfType("pong")).toHaveLength(3);
    // The socket was never closed: no 4408, no replay storm, one connection.
    expect(transport.sockets).toHaveLength(1);
    expect(subscription.status().state).toBe("live");
  });

  it("answers a ping on a socket whose stream it has not welcomed yet", () => {
    const transport = fakeTransport();
    const clock = manualClock();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/chat/7",
      webSocket: transport.factory,
      schedule: clock.schedule,
      session: null,
    });
    client.subscribe(STREAM);
    const socket = transport.last();
    socket.accept();
    socket.deliver({ v: 1, type: "ping", payload: {} });
    expect(socket.receivedOfType("pong")).toHaveLength(1);
  });

  it("reconnects when the server goes silent without closing", () => {
    // A sleeping laptop, a dead NAT binding: no close event ever arrives, and
    // a client that waits on one waits forever.
    const transport = fakeTransport();
    const clock = manualClock();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/chat/7",
      webSocket: transport.factory,
      schedule: clock.schedule,
      random: () => 0.5,
      heartbeat: { intervalMs: 25_000, timeoutMs: 10_000 },
      session: null,
    });
    const subscription = client.subscribe(STREAM);
    const first = transport.last();
    first.accept();
    new FakeServer(first).pump();

    // The liveness timer is the only thing queued; firing it means "no frame
    // for the server's whole heartbeat window".
    const liveness = clock.pending.find((task) => task.ms === 35_000);
    expect(liveness).toBeDefined();
    clock.flush();

    expect(first.closedByClient).toBe(true);
    expect(subscription.status().state).toBe("reconnecting");
    clock.runNext();
    expect(transport.sockets).toHaveLength(2);
  });
});
