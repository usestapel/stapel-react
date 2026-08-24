/**
 * Several module streams over ONE socket, and the socket-per-stream topology
 * the shipped v1 server actually serves — the same code path, differing only
 * in how many streams land in a group.
 */
import { describe, expect, it } from "vitest";
import { createRealtimeClient } from "../src/index.js";
import type { RealtimeFrame } from "../src/index.js";
import { fakeTransport, liveFrame, manualClock, signalFrame } from "./fakeServer.js";

const CHAT = "chat:conv:7";
const NOTIFICATIONS = "notifications:ws:42";

describe("multiplexing", () => {
  it("puts every stream that resolves to one URL on one socket", () => {
    const transport = fakeTransport();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/mux",
      webSocket: transport.factory,
      schedule: manualClock().schedule,
      session: null,
    });
    const chat: RealtimeFrame[] = [];
    const notifications: RealtimeFrame[] = [];
    const a = client.subscribe(CHAT, { onFrame: (f) => chat.push(f) });
    const socket = transport.last();
    socket.accept();
    const b = client.subscribe(NOTIFICATIONS, { onFrame: (f) => notifications.push(f) });

    expect(transport.sockets).toHaveLength(1);
    // One hello per stream — the hello IS the subscribe, and the server
    // re-runs authorize() on each one.
    expect(socket.receivedOfType("hello").map((f) => f.stream)).toEqual([
      CHAT,
      NOTIFICATIONS,
    ]);

    // Routing is by `envelope.stream`, which the server populates on every
    // frame precisely so this is possible.
    socket.deliver(liveFrame(CHAT, 1, { body: "hi", seq: 1 }));
    socket.deliver(signalFrame(NOTIFICATIONS, "notifications.unread", { count: 3 }));
    expect(chat).toHaveLength(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.type).toBe("notifications.unread");

    // Cursors are per stream: one journal must not move another's resume point.
    expect(client.cursors()).toEqual({ [CHAT]: 1, [NOTIFICATIONS]: 0 });

    // Unsubscribing one stream keeps the socket for the other; v1 has no
    // unsubscribe frame, so closing it IS the unsubscribe — and only when the
    // last stream leaves.
    b.close();
    expect(socket.closedByClient).toBe(false);
    a.close();
    expect(socket.closedByClient).toBe(true);
  });

  it("drops a frame for a stream nobody is watching any more", () => {
    const transport = fakeTransport();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/mux",
      webSocket: transport.factory,
      schedule: manualClock().schedule,
      session: null,
    });
    const seen: RealtimeFrame[] = [];
    client.subscribe(CHAT);
    const socket = transport.last();
    socket.accept();
    const b = client.subscribe(NOTIFICATIONS, { onFrame: (f) => seen.push(f) });
    b.close();
    socket.deliver(signalFrame(NOTIFICATIONS, "notifications.unread", { count: 9 }));
    expect(seen).toHaveLength(0);
  });

  it("gives each stream its own socket when the URL resolver says so", () => {
    // The shipped v1 topology: `ws/chat/<uuid>`, one stream per socket.
    const transport = fakeTransport();
    const client = createRealtimeClient({
      url: (stream) => `wss://api.example.test/ws/${stream.replace(/:/g, "/")}`,
      webSocket: transport.factory,
      schedule: manualClock().schedule,
      session: null,
    });
    client.subscribe(CHAT);
    client.subscribe(NOTIFICATIONS);
    expect(transport.sockets.map((s) => s.url)).toEqual([
      "wss://api.example.test/ws/chat/conv/7",
      "wss://api.example.test/ws/notifications/ws/42",
    ]);
  });

  it("routes an unlabelled frame to the sole stream on a single-stream socket", () => {
    // Belt for a server old enough to omit `stream`; on a multiplexed socket
    // such a frame is dropped instead of guessed at.
    const transport = fakeTransport();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/chat/7",
      webSocket: transport.factory,
      schedule: manualClock().schedule,
      session: null,
    });
    const seen: RealtimeFrame[] = [];
    client.subscribe(CHAT, { onFrame: (f) => seen.push(f) });
    const socket = transport.last();
    socket.accept();
    socket.deliver({ v: 1, type: "live", payload: { body: "x" }, seq: 1 });
    expect(seen).toHaveLength(1);
  });

  it("shares one subscription's cursor between two components on one key", () => {
    const transport = fakeTransport();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/chat/7",
      webSocket: transport.factory,
      schedule: manualClock().schedule,
      session: null,
    });
    const first: RealtimeFrame[] = [];
    const second: RealtimeFrame[] = [];
    const a = client.subscribe(CHAT, { onFrame: (f) => first.push(f) });
    const b = client.subscribe(CHAT, { onFrame: (f) => second.push(f) });
    const socket = transport.last();
    socket.accept();
    expect(transport.sockets).toHaveLength(1);
    socket.deliver(liveFrame(CHAT, 1, { body: "hi", seq: 1 }));
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    a.close();
    expect(socket.closedByClient).toBe(false);
    b.close();
    expect(socket.closedByClient).toBe(true);
  });
});
