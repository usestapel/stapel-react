/**
 * The resumable client, driven frame by frame against a fake transport: the
 * handshake, the dedup cursor, the resync answer, the two refusals that must
 * NOT be retried, and the backoff that reconnects everything else.
 */
import { describe, expect, it, vi } from "vitest";
import { createChatSocket } from "../src/index.js";
import type { ChatServerFrame, ChatSocketStatus } from "../src/index.js";
import { fakeTransport, messageFrame } from "./harnessSocket.js";

interface Driven {
  readonly transport: ReturnType<typeof fakeTransport>;
  readonly frames: ChatServerFrame[];
  readonly statuses: ChatSocketStatus[];
  readonly socket: ReturnType<typeof createChatSocket>;
  /** Pending reconnect callbacks the fake scheduler captured. */
  readonly retries: { fn: () => void; delay: number }[];
  cursor: number;
}

function drive(options: { lastSeq?: () => number; maxAttempts?: number } = {}): Driven {
  const transport = fakeTransport();
  const frames: ChatServerFrame[] = [];
  const statuses: ChatSocketStatus[] = [];
  const retries: { fn: () => void; delay: number }[] = [];
  const state = { cursor: 0 };
  const socket = createChatSocket({
    url: "wss://chat.test/ws/chat/c-1",
    lastSeq: options.lastSeq ?? (() => state.cursor),
    onFrame: (frame) => frames.push(frame),
    onStatus: (status) => statuses.push(status),
    webSocket: transport.factory,
    schedule: (fn, delay) => {
      retries.push({ fn, delay });
      return () => {
        const index = retries.findIndex((entry) => entry.fn === fn);
        if (index >= 0) retries.splice(index, 1);
      };
    },
    random: () => 0.5,
    ...(options.maxAttempts !== undefined
      ? { reconnect: { baseDelayMs: 100, maxDelayMs: 1000, maxAttempts: options.maxAttempts } }
      : { reconnect: { baseDelayMs: 100, maxDelayMs: 1000 } }),
  });
  return {
    transport,
    frames,
    statuses,
    socket,
    retries,
    get cursor() {
      return state.cursor;
    },
    set cursor(next: number) {
      state.cursor = next;
    },
  };
}

describe("the handshake", () => {
  it("opens with hello carrying the consumer's cursor", () => {
    const d = drive();
    d.cursor = 12;
    d.transport.last().open();
    expect(d.transport.last().sent).toEqual([{ type: "hello", last_seq: 12 }]);
    expect(d.socket.status().state).toBe("open");
  });

  it("reports connecting before it is open", () => {
    const d = drive();
    expect(d.statuses[0]?.state).toBe("connecting");
  });
});

describe("delivery", () => {
  it("forwards replay and live frames in order", () => {
    const d = drive();
    d.transport.last().open();
    d.transport.last().emit({ type: "welcome", conversation_id: "c-1", server_seq: 3 });
    d.transport.last().emit(messageFrame(2));
    d.transport.last().emit(messageFrame(3));
    d.transport.last().emit({ type: "replay_done", up_to_seq: 3 });
    expect(d.frames.map((f) => f.type)).toEqual([
      "welcome",
      "message",
      "message",
      "replay_done",
    ]);
  });

  it("drops a seq it has already surfaced — the replay/live overlap is invisible", () => {
    const d = drive();
    d.transport.last().open();
    d.transport.last().emit(messageFrame(4));
    d.transport.last().emit(messageFrame(4));
    d.transport.last().emit(messageFrame(3));
    const seqs = d.frames
      .filter((f): f is Extract<ChatServerFrame, { type: "message" }> => f.type === "message")
      .map((f) => f.seq);
    expect(seqs).toEqual([4]);
  });

  it("an unreadable frame is dropped WITHOUT advancing the cursor", () => {
    const d = drive();
    d.transport.last().open();
    d.transport.last().emitRaw("{not json");
    d.transport.last().emit({ type: "message", seq: "nope" });
    d.transport.last().emit(messageFrame(1));
    expect(d.frames).toHaveLength(1);
    expect(d.frames[0]).toMatchObject({ type: "message", seq: 1 });
  });

  it("forwards error{resync} verbatim — the consumer owns re-hydration", () => {
    const d = drive();
    d.transport.last().open();
    d.transport.last().emit({ type: "error", code: "resync", message: "gap 900" });
    expect(d.frames[0]).toMatchObject({ type: "error", code: "resync" });
  });
});

describe("reconnect", () => {
  it("resumes from the cursor the CONSUMER holds now, not the one it opened with", () => {
    const d = drive();
    d.cursor = 5;
    d.transport.last().open();
    expect(d.transport.last().sent).toEqual([{ type: "hello", last_seq: 5 }]);

    d.transport.last().serverClose(1006);
    expect(d.socket.status().state).toBe("degraded");
    // While the socket was down, the store advanced by REST.
    d.cursor = 9;
    d.retries[0]?.fn();
    d.transport.last().open();
    expect(d.transport.last().sent).toEqual([{ type: "hello", last_seq: 9 }]);
    expect(d.transport.sockets).toHaveLength(2);
  });

  it("does not re-deliver what it already sent, across the reconnect", () => {
    const d = drive();
    d.transport.last().open();
    d.transport.last().emit(messageFrame(4));
    d.transport.last().serverClose(1006);
    d.retries[0]?.fn();
    d.transport.last().open();
    // The server replays from last_seq; a slow client may see 4 again.
    d.transport.last().emit(messageFrame(4));
    d.transport.last().emit(messageFrame(5));
    const seqs = d.frames
      .filter((f): f is Extract<ChatServerFrame, { type: "message" }> => f.type === "message")
      .map((f) => f.seq);
    expect(seqs).toEqual([4, 5]);
  });

  it("backs off exponentially, jittered", () => {
    const d = drive();
    d.transport.last().open();
    d.transport.last().serverClose(1006);
    d.retries[0]?.fn();
    d.transport.last().serverClose(1006);
    // base 100 → attempt 1: 100 × 0.75 (jitter at random()=0.5) = 75;
    // attempt 2: 200 × 0.75 = 150.
    expect(d.retries.map((r) => r.delay)).toEqual([75, 150]);
  });

  it("gives up after the retry budget, so the caller can fall back", () => {
    const d = drive({ maxAttempts: 2 });
    d.transport.last().open();
    d.transport.last().serverClose(1006);
    d.retries[0]?.fn();
    d.transport.last().serverClose(1006);
    expect(d.socket.status()).toMatchObject({
      state: "closed",
      refusal: "unreachable",
    });
  });
});

describe("a refusal is not a fault", () => {
  it("4401 closes for good — reconnecting would hammer the host", () => {
    const d = drive();
    d.transport.last().serverClose(4401);
    expect(d.socket.status()).toMatchObject({
      state: "closed",
      refusal: "unauthenticated",
    });
    expect(d.retries).toHaveLength(0);
  });

  it("4403 closes for good too", () => {
    const d = drive();
    d.transport.last().serverClose(4403);
    expect(d.socket.status()).toMatchObject({
      state: "closed",
      refusal: "not_participant",
    });
    expect(d.retries).toHaveLength(0);
  });
});

describe("deliberate close", () => {
  it("closes the connection, cancels the retry and stops delivering", () => {
    const d = drive();
    d.transport.last().open();
    d.transport.last().serverClose(1006);
    expect(d.retries).toHaveLength(1);

    d.socket.close();
    expect(d.retries).toHaveLength(0);

    // Anything still in flight after teardown must not reach the consumer.
    d.transport.last().emit(messageFrame(1));
    expect(d.frames).toHaveLength(0);
    expect(d.socket.status().state).toBe("closed");
  });

  it("closes the live connection object", () => {
    const d = drive();
    d.transport.last().open();
    d.socket.close();
    expect(d.transport.last().closed).toBe(true);
  });
});

describe("ack and ping", () => {
  it("sends the frames the protocol defines", () => {
    const d = drive();
    d.transport.last().open();
    d.socket.ack(7);
    d.socket.ping();
    expect(d.transport.last().sent.slice(1)).toEqual([
      { type: "ack", seq: 7 },
      { type: "ping" },
    ]);
  });

  it("a send on a dead socket is swallowed, not thrown", () => {
    const d = drive();
    d.transport.last().open();
    d.transport.last().throwOnSend = true;
    expect(() => d.socket.ping()).not.toThrow();
  });
});

describe("the send frame is typed but never emitted", () => {
  it("the client exposes no way to write over the socket", () => {
    const d = drive();
    d.transport.last().open();
    // Writes go over REST: the socket's refusals carry codes with no i18n key.
    expect(Object.keys(d.socket).sort()).toEqual(["ack", "close", "ping", "status"]);
    const sentTypes = d.transport.last().sent.map((frame) => (frame as { type: string }).type);
    expect(sentTypes).not.toContain("send");
  });
});

describe("the browser factory", () => {
  it("is only reachable where WebSocket exists", async () => {
    const { canOpenWebSocket } = await import("../src/index.js");
    // jsdom provides one; the guard exists for SSR/node, where it does not.
    expect(canOpenWebSocket()).toBe(typeof WebSocket !== "undefined");
    expect(vi.isMockFunction(canOpenWebSocket)).toBe(false);
  });
});
