/**
 * `kick` — rights withdrawn while connected. The reason arrives in a FRAME
 * before the close (4410), so a client that only reads close codes has the
 * fact and not the reason, and can only say "disconnected".
 */
import { describe, expect, it } from "vitest";
import { createRealtimeClient } from "../src/index.js";
import type { RealtimeFrame } from "../src/index.js";
import { FakeServer, STREAM, fakeTransport, kickFrame, manualClock } from "./fakeServer.js";

describe("kick", () => {
  it("is terminal, and it carries the server's reason", () => {
    const transport = fakeTransport();
    const clock = manualClock();
    const frames: RealtimeFrame[] = [];
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/chat/7",
      webSocket: transport.factory,
      schedule: clock.schedule,
      session: null,
    });
    const subscription = client.subscribe(STREAM, {
      onFrame: (frame) => frames.push(frame),
    });
    const socket = transport.last();
    socket.accept();
    new FakeServer(socket).pump();

    socket.deliver(kickFrame(STREAM, "removed_from_conversation"));
    expect(subscription.status().state).toBe("refused");
    expect(subscription.status().refusal).toBe("revoked");
    expect(subscription.status().reason).toBe("removed_from_conversation");
    expect(frames.at(-1)?.type).toBe("kick");

    // The 4410 that follows changes nothing and starts no reconnect.
    socket.serverClose(4410);
    expect(subscription.status().reason).toBe("removed_from_conversation");
    expect(clock.pending.filter((t) => !t.cancelled)).toHaveLength(0);
    expect(transport.sockets).toHaveLength(1);
    expect(client.getState().reason).toBe("removed_from_conversation");
  });

  it("defaults the reason when the server sent none", () => {
    const transport = fakeTransport();
    const client = createRealtimeClient({
      url: "wss://api.example.test/ws/chat/7",
      webSocket: transport.factory,
      schedule: manualClock().schedule,
      session: null,
    });
    const subscription = client.subscribe(STREAM);
    const socket = transport.last();
    socket.accept();
    socket.deliver({ v: 1, type: "kick", stream: STREAM, payload: {} });
    expect(subscription.status().reason).toBe("access_revoked");
  });
});
