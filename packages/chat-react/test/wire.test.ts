/**
 * THE ACCEPTANCE TEST FOR THE CUTOVER: the frames a 0.6.x server actually
 * sends, through the path a browser actually takes.
 *
 * This file is the answer to how the defect survived. The pair's own decoder
 * was CORRECT — about a protocol stapel-chat deleted in 0.3.0 — and every
 * test in the suite fed it frames from that protocol through a fake standing
 * where `new WebSocket()` stands. Green, and talking to nobody: run the old
 * decoder against a real 0.6 server's frames and it answers
 *
 *     live -> null   replay -> null   welcome -> null   ping -> null
 *
 * so no message ever arrived, the heartbeat was never answered, the server
 * closed 4408 every 35 seconds, and the pair polled forever.
 *
 * So the two things asserted below are the two things that were false:
 *
 *  1. a frame the SERVER builds decodes to a MESSAGE, and
 *  2. a `ping` is ANSWERED, so the 4408 loop cannot recur.
 *
 * Nothing here injects a transport. `@stapel/realtime`'s `browserSocketFactory`
 * runs for real and `globalThis.WebSocket` is the double — so the handshake
 * under test is the one a page performs, with no `Authorization` header,
 * because a browser has no way to send one.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRealtimeClient } from "@stapel/realtime";
import type { RealtimeClient, RealtimeFrame, RealtimeStreamStatus } from "@stapel/realtime";
import {
  chatConversationStream,
  chatInboxStream,
  chatSocketUrl,
  readChatMessageFrame,
} from "../src/index.js";
import { ChatServer, chatMessagePayload, installBrowserWebSocket } from "./chatServer.js";
import type { BrowserWebSocketEnvironment } from "./chatServer.js";
import { CONVERSATION_ID } from "./fixtures.js";

const ORIGIN = "wss://chat.test";
const stream = chatConversationStream(CONVERSATION_ID);
const URL_ = chatSocketUrl(ORIGIN, stream) ?? "";

let env: BrowserWebSocketEnvironment;

beforeEach(() => {
  env = installBrowserWebSocket();
});

afterEach(() => {
  env.restore();
});

interface Driven {
  readonly client: RealtimeClient;
  readonly frames: RealtimeFrame[];
  readonly statuses: RealtimeStreamStatus[];
  readonly retries: { fn: () => void; delay: number }[];
  cursor: number;
}

/**
 * The substrate's client with NO transport injected, resuming from whatever
 * cursor the test says the store holds. `schedule` and `random` are handed in
 * because a timer and a jitter draw are not the subject here; the socket is.
 */
function drive(options: { lastSeq?: () => number; url?: string; key?: string } = {}): Driven {
  const frames: RealtimeFrame[] = [];
  const statuses: RealtimeStreamStatus[] = [];
  const retries: { fn: () => void; delay: number }[] = [];
  const driven: Driven = {
    client: createRealtimeClient({
      url: options.url ?? URL_,
      schedule: (fn, delay) => {
        retries.push({ fn, delay });
        return () => {
          const index = retries.findIndex((entry) => entry.fn === fn);
          if (index >= 0) retries.splice(index, 1);
        };
      },
      random: () => 0.5,
    }),
    frames,
    statuses,
    retries,
    cursor: 0,
  };
  driven.client.subscribe(options.key ?? stream.key, {
    lastSeq: options.lastSeq ?? (() => driven.cursor),
    onFrame: (frame) => frames.push(frame),
    onState: (status) => statuses.push(status),
  });
  return driven;
}

function serverFor(driven: Driven, key = stream.key): ChatServer {
  void driven;
  return new ChatServer(env.last(), { stream: key });
}

describe("the handshake a browser can actually perform", () => {
  it("opens with the URL alone — the cookie channel, no second argument", () => {
    drive();
    expect(env.sockets).toHaveLength(1);
    expect(env.last().url).toBe("wss://chat.test/ws/chat/" + CONVERSATION_ID);
    // `new WebSocket(url)`, not `new WebSocket(url, [])` and certainly not a
    // header: the browser attaches its httpOnly JWT cookie itself, and core's
    // channels middleware reads it (channel 4) behind an origin allowlist.
    // Nothing in this package can add a header, which is the point — the
    // backend's own smoke test had the mirror-image defect and sent one.
    expect(env.last().protocols).toBeUndefined();
    for (const frame of env.last().sent) {
      expect(JSON.stringify(frame)).not.toContain("Authorization");
    }
  });

  it("subscribes with hello{last_seq} carrying the REV_SEQ the store holds", () => {
    const driven = drive();
    driven.cursor = 41; // a rev_seq, not a thread seq
    const server = serverFor(driven);
    server.accept();
    expect(server.helloFrames).toBe(1);
    expect(server.lastHelloCursor).toBe(41);
    expect(env.last().received("hello")[0]).toMatchObject({
      v: 1,
      type: "hello",
      stream: stream.key,
      payload: { last_seq: 41 },
    });
  });
});

describe("a frame a 0.6 server sends decodes to a MESSAGE", () => {
  it("welcome → replay → replay_done → live, every one of them readable", () => {
    const driven = drive();
    const server = serverFor(driven);
    server.fill(3, CONVERSATION_ID);
    server.accept();

    // The old decoder answered `null` to every one of these.
    const types = driven.frames.map((frame) => frame.type);
    expect(types).toEqual(["welcome", "replay", "replay", "replay", "replay_done"]);

    const replayed = driven.frames
      .map((frame) => readChatMessageFrame(frame))
      .filter((message) => message !== null);
    expect(replayed).toHaveLength(3);
    expect(replayed[0]).toMatchObject({
      message_id: "m-1",
      conversation_id: CONVERSATION_ID,
      seq: 1,
      rev_seq: 1,
      body: "message 1",
      deleted: false,
    });

    server.publish(chatMessagePayload({ seq: 4, conversationId: CONVERSATION_ID }));
    const live = driven.frames[driven.frames.length - 1];
    expect(live?.type).toBe("live");
    expect(readChatMessageFrame(live as RealtimeFrame)).toMatchObject({
      message_id: "m-4",
      seq: 4,
      rev_seq: 4,
    });
    // The stream is live and the resume cursor moved with it.
    expect(driven.client.streamStatus(stream.key)?.state).toBe("live");
    expect(driven.client.cursors()[stream.key]).toBe(4);
  });

  it("keeps the two sequences apart: an edit re-arrives with a NEW rev_seq and its OLD seq", () => {
    const driven = drive();
    const server = serverFor(driven);
    server.fill(3, CONVERSATION_ID);
    server.accept();

    // `services.edit_message` bumps rev_seq and leaves seq alone.
    server.publish(
      chatMessagePayload({
        seq: 2,
        revSeq: 4,
        conversationId: CONVERSATION_ID,
        body: "fixed a typo",
        edited: true,
      })
    );
    const frame = driven.frames[driven.frames.length - 1] as RealtimeFrame;
    expect(frame.envelopeSeq).toBe(4); // the resume cursor
    expect(frame.payloadSeq).toBe(2); // the place in the thread
    const message = readChatMessageFrame(frame);
    expect(message).toMatchObject({ seq: 2, rev_seq: 4, edited: true });
    // The RESUME cursor is the envelope's, so a reconnect asks for rev 4 —
    // conflating them here is what dropped every edit across a resume.
    expect(driven.client.cursors()[stream.key]).toBe(4);
  });

  it("a tombstone keeps its id and loses its body — the row a cache purges by", () => {
    const driven = drive();
    const server = serverFor(driven);
    server.fill(2, CONVERSATION_ID);
    server.accept();
    server.publish(
      chatMessagePayload({ seq: 1, revSeq: 3, conversationId: CONVERSATION_ID, deleted: true })
    );
    const message = readChatMessageFrame(
      driven.frames[driven.frames.length - 1] as RealtimeFrame
    );
    expect(message).toMatchObject({
      message_id: "m-1",
      seq: 1,
      rev_seq: 3,
      body: "",
      deleted: true,
      attachments: [],
    });
  });

  it("the replay/live overlap after a resume is delivered once", () => {
    const driven = drive();
    driven.cursor = 2;
    const server = serverFor(driven);
    server.fill(3, CONVERSATION_ID);
    server.accept();
    // The server replayed rev 3 only; a live fan-out of the same row is
    // dropped on both ends.
    const seqs = driven.frames
      .map((frame) => readChatMessageFrame(frame))
      .filter((m) => m !== null)
      .map((m) => m.seq);
    expect(seqs).toEqual([3]);
  });
});

describe("the heartbeat is ANSWERED — the 4408 loop cannot recur", () => {
  it("a server ping is answered with a pong on the same socket", () => {
    const driven = drive();
    const server = serverFor(driven);
    server.accept();
    const survived = server.heartbeat();
    // The double closes 4408 when no pong came back, exactly as
    // `_heartbeat_loop` does. Surviving the tick IS the assertion.
    expect(survived).toBe(true);
    expect(env.last().received("pong")).toHaveLength(1);
    expect(env.last().received("pong")[0]).toMatchObject({ v: 1, type: "pong" });
    // The runtime answers the heartbeat and does NOT hand it up: a `ping` is
    // protocol, not news, and a consumer that had to know about it would be a
    // consumer that could forget to answer it.
    expect(driven.frames.some((frame) => frame.type === "ping")).toBe(false);
  });

  it("thirty heartbeat windows later the socket is the SAME one, never reopened", () => {
    // The defect's signature: one socket per 35 seconds, a full replay each
    // time, a retry budget draining, and a person told "refreshing every few
    // seconds". Thirty windows is a quarter of an hour of that.
    const driven = drive();
    const server = serverFor(driven);
    server.fill(1, CONVERSATION_ID);
    server.accept();
    for (let tick = 0; tick < 30; tick += 1) {
      expect(server.heartbeat()).toBe(true);
    }
    expect(env.sockets).toHaveLength(1);
    // The only timer still armed is the liveness watchdog (heartbeat +
    // timeout), re-armed by every frame. No reconnect was ever scheduled, so
    // no backoff delay is pending and no retry budget is being spent.
    expect(driven.retries.map((entry) => entry.delay)).toEqual([35_000]);
    expect(driven.client.streamStatus(stream.key)?.state).toBe("live");
    // One hello: the stream was never re-subscribed, so the journal was never
    // replayed a second time.
    expect(server.helloFrames).toBe(1);
  });
});

describe("a gap wider than the replay window is an instruction, not an error", () => {
  it("resync leaves the socket open and says how far behind we are", () => {
    const driven = drive({ lastSeq: () => 1 });
    const server = new ChatServer(env.last(), { stream: stream.key, maxReplay: 2 });
    server.fill(10, CONVERSATION_ID);
    server.accept();
    const status = driven.client.streamStatus(stream.key);
    expect(status?.state).toBe("resync");
    expect(status?.gap).toBe(9);
    expect(status?.serverSeq).toBe(10);
    expect(env.last().closedByClient).toBe(false);
  });
});

describe("the inbox socket the pair used to declare did not exist", () => {
  it("ws/chat/inbox welcomes ephemerally and carries chat.inbox signals", () => {
    const inbox = chatInboxStream("u-buyer");
    expect(inbox.key).toBe("chat:user:u-buyer");
    const url = chatSocketUrl(ORIGIN, inbox) ?? "";
    expect(url).toBe("wss://chat.test/ws/chat/inbox");

    const driven = drive({ url, key: inbox.key });
    const server = new ChatServer(env.last(), { stream: inbox.key, ephemeral: true });
    server.accept();
    // An ephemeral welcome goes straight to live: there is no journal to
    // replay and nothing to resume.
    expect(driven.client.streamStatus(inbox.key)?.state).toBe("live");

    server.signal("chat.inbox", {
      conversation_id: CONVERSATION_ID,
      conversation_kind: "direct",
      last_seq: 7,
      message: chatMessagePayload({ seq: 7, conversationId: CONVERSATION_ID }),
    });
    const signal = driven.frames[driven.frames.length - 1] as RealtimeFrame;
    expect(signal.type).toBe("chat.inbox");
    // Structurally ephemeral: a signal carries no seq, so it can never move a
    // resume cursor.
    expect(signal.envelopeSeq).toBeUndefined();
    expect(driven.client.cursors()[inbox.key]).toBe(0);
  });
});
