/**
 * Resume by envelope seq — against the fake server that reproduces
 * `ResumableStreamConsumer`.
 */
import { describe, expect, it } from "vitest";
import { createRealtimeClient } from "../src/index.js";
import type { RealtimeFrame } from "../src/index.js";
import { FakeServer, STREAM, fakeTransport, manualClock } from "./fakeServer.js";

function harness(options?: { lastSeq?: () => number }) {
  const transport = fakeTransport();
  const clock = manualClock();
  const frames: RealtimeFrame[] = [];
  const client = createRealtimeClient({
    url: "wss://api.example.test/ws/chat/7",
    webSocket: transport.factory,
    schedule: clock.schedule,
    random: () => 0.5,
    session: null,
  });
  const subscription = client.subscribe(STREAM, {
    onFrame: (frame) => frames.push(frame),
    ...(options?.lastSeq ? { lastSeq: options.lastSeq } : {}),
  });
  return { transport, clock, client, frames, subscription };
}

describe("resume", () => {
  it("replays exactly the gap and then goes live", () => {
    const h = harness();
    const socket = h.transport.last();
    const server = new FakeServer(socket);
    server.fill(3);
    socket.accept();
    server.pump();

    // test_consumers_resumable.py:52-64 — welcome, replay 1..3, replay_done.
    expect(h.frames.map((f) => f.type)).toEqual([
      "welcome",
      "replay",
      "replay",
      "replay",
      "replay_done",
    ]);
    expect(h.subscription.status().state).toBe("live");
    expect(h.subscription.cursor()).toBe(3);

    server.publish(4, { body: "m4", seq: 4 });
    expect(h.frames.at(-1)?.type).toBe("live");
    expect(h.subscription.cursor()).toBe(4);
  });

  it("hands the highest ENVELOPE seq back on reconnect, not the payload seq", () => {
    const h = harness();
    const first = h.transport.last();
    const server = new FakeServer(first);
    // rev_seq 19 while the message sits at thread position 12 — the shape an
    // edited message arrives in (stapel-chat/MODULE.md §the message payload).
    server.journal.push({ seq: 19, payload: { body: "edited", seq: 12 } });
    first.accept();
    server.pump();
    expect(h.subscription.cursor()).toBe(19);

    first.serverClose(1006);
    h.clock.runNext();
    const second = h.transport.last();
    second.accept();
    const hello = second.receivedOfType("hello")[0];
    expect(hello?.payload?.["last_seq"]).toBe(19);
    expect(hello?.stream).toBe(STREAM);
  });

  it("never re-surfaces a frame it already has (the replay/live overlap)", () => {
    const h = harness();
    const socket = h.transport.last();
    const server = new FakeServer(socket);
    server.fill(3);
    socket.accept();
    server.pump();
    const before = h.frames.length;
    // A late fan-out for a row the client already holds. The server dedups on
    // its side too; this proves the client does not depend on that.
    socket.deliver({ v: 1, type: "live", stream: STREAM, payload: { body: "m2" }, seq: 2 });
    expect(h.frames).toHaveLength(before);
    expect(h.subscription.cursor()).toBe(3);
  });

  it("takes the consumer's REST-advanced cursor into the hello", () => {
    let restCursor = 0;
    const h = harness({ lastSeq: () => restCursor });
    const first = h.transport.last();
    first.accept();
    new FakeServer(first).pump();
    first.serverClose(1006);
    // While the socket was down the consumer paged history over REST.
    restCursor = 42;
    h.clock.runNext();
    const second = h.transport.last();
    second.accept();
    expect(second.receivedOfType("hello")[0]?.payload?.["last_seq"]).toBe(42);
  });

  it("reports a gap wider than the window as `resync`, not as an error", () => {
    const h = harness();
    const socket = h.transport.last();
    const server = new FakeServer(socket, { maxReplay: 10 });
    server.fill(50);
    socket.accept();
    server.pump();
    expect(h.subscription.status().state).toBe("resync");
    expect(h.subscription.status().gap).toBe(50);
    expect(h.subscription.status().serverSeq).toBe(50);
    // The socket stays open: re-hydration is the consumer's job, over REST.
    expect(socket.closedByClient).toBe(false);
    // And the cursor is NOT advanced by a resync — we are not current.
    expect(h.subscription.cursor()).toBe(0);
  });

  it("never lets an ephemeral frame move a resume cursor", () => {
    const h = harness();
    const socket = h.transport.last();
    const server = new FakeServer(socket);
    server.fill(2);
    socket.accept();
    server.pump();
    expect(h.subscription.cursor()).toBe(2);
    // A module bug: a signal carrying a seq. Delivered, never journalled.
    socket.deliver({
      v: 1,
      type: "chat.read",
      stream: STREAM,
      payload: { conversation_id: "7", user_id: "u-1", last_read_seq: 9 },
      seq: 99,
    });
    expect(h.frames.at(-1)?.type).toBe("chat.read");
    expect(h.subscription.cursor()).toBe(2);
  });

  it("drops an unreadable frame without advancing anything", () => {
    const h = harness();
    const socket = h.transport.last();
    const server = new FakeServer(socket);
    server.fill(1);
    socket.accept();
    server.pump();
    const before = h.frames.length;
    socket.deliverRaw("{ not json");
    socket.deliver({ v: 2, type: "live", stream: STREAM, payload: {}, seq: 500 });
    expect(h.frames).toHaveLength(before);
    expect(h.subscription.cursor()).toBe(1);
  });
});
