/**
 * The wire mirror, pinned against `stapel_realtime/envelope.py`. Every frame
 * below is copied from the server suite (`tests/test_envelope.py`,
 * `tests/test_consumers_resumable.py`) or from `stapel-chat/MODULE.md`
 * §"The wire contract" — this file is the place the two halves are compared,
 * not a comment somewhere claiming they agree.
 */
import { describe, expect, it } from "vitest";
import {
  CLIENT_FRAME_TYPES,
  PROTOCOL_FRAME_TYPES,
  SERVER_FRAME_TYPES,
  WIRE_VERSION,
  decodeFrame,
  encodeFrame,
  helloFrame,
  pongFrame,
} from "../src/index.js";

describe("envelope v1", () => {
  it("mirrors the server's version and its reserved type set", () => {
    expect(WIRE_VERSION).toBe(1);
    // envelope.py:60 CLIENT_FRAME_TYPES
    expect([...CLIENT_FRAME_TYPES].sort()).toEqual(["hello", "ping", "pong"]);
    // envelope.py:64-66 SERVER_FRAME_TYPES
    expect([...SERVER_FRAME_TYPES].sort()).toEqual([
      "error",
      "kick",
      "live",
      "ping",
      "pong",
      "replay",
      "replay_done",
      "resync",
      "welcome",
    ]);
    // envelope.py:71 — `ephemeral` stays reserved though nothing emits it.
    expect(PROTOCOL_FRAME_TYPES.has("ephemeral")).toBe(true);
    expect(PROTOCOL_FRAME_TYPES.size).toBe(11);
  });

  it("builds the minimal frame the server's own test asserts", () => {
    // test_envelope.py:16
    expect(JSON.parse(encodeFrame("ping"))).toEqual({
      v: 1,
      type: "ping",
      payload: {},
    });
  });

  it("omits `seq` and `stream` when unset, and carries them when set", () => {
    const minimal = JSON.parse(encodeFrame("hello", { last_seq: 3 }));
    expect("seq" in minimal).toBe(false);
    expect("stream" in minimal).toBe(false);
    expect(JSON.parse(helloFrame("chat:conv:7", 3))).toEqual({
      v: 1,
      type: "hello",
      stream: "chat:conv:7",
      payload: { last_seq: 3 },
    });
    expect(JSON.parse(pongFrame("chat:conv:7")).type).toBe("pong");
  });

  it("keeps the resume cursor and the ordering key apart", () => {
    // stapel-chat/MODULE.md:299 — envelope.seq is rev_seq (the resume cursor);
    // payload.seq is the message's place in the thread (the sort key). An edit
    // re-arrives with its EXISTING payload.seq and a NEW envelope.seq, which is
    // why one field cannot serve both.
    const frame = decodeFrame({
      v: 1,
      type: "live",
      stream: "chat:conv:7",
      payload: { message_id: "u-1", seq: 12, rev_seq: 19, body: "edited" },
      seq: 19,
    });
    expect(frame?.envelopeSeq).toBe(19);
    expect(frame?.payloadSeq).toBe(12);
    expect(frame?.journal).toBe(true);
    expect(frame?.signal).toBe(false);
  });

  it("reads frame kind structurally — `seq` present or absent, no flag", () => {
    const signal = decodeFrame({
      v: 1,
      type: "chat.activity",
      stream: "chat:conv:7",
      payload: { conversation_id: "7", user_id: "u-1", state: "typing", ttl_s: 5 },
    });
    expect(signal?.journal).toBe(false);
    expect(signal?.signal).toBe(true);
    expect(signal?.envelopeSeq).toBeUndefined();
  });

  it("parses an unknown type (a signal wears its own name)", () => {
    // test_envelope.py:62-65
    expect(decodeFrame({ v: 1, type: "whatever", payload: {} })?.type).toBe("whatever");
    // test_envelope.py:67-68
    expect(decodeFrame({ v: 1, type: "ping" })?.payload).toEqual({});
  });

  it.each([
    ["not an envelope at all", "not a dict"],
    ["no version", { type: "ping", payload: {} }],
    ["unknown version", { v: 2, type: "ping", payload: {} }],
    ["no type", { v: 1, payload: {} }],
    ["empty type", { v: 1, type: "", payload: {} }],
    ["payload is not an object", { v: 1, type: "ping", payload: [] }],
    ["seq is not an integer", { v: 1, type: "live", payload: {}, seq: "x" }],
    ["stream is not a string", { v: 1, type: "live", payload: {}, stream: 7 }],
  ])("rejects a malformed frame: %s", (_name, raw) => {
    // test_envelope.py:45-59 — the same table, and `null` rather than a partly
    // trusted object, because an unreadable frame must not move a cursor.
    expect(decodeFrame(raw)).toBeNull();
  });

  it("decodes the JSON text a socket actually delivers", () => {
    const frame = decodeFrame(
      JSON.stringify({ v: 1, type: "replay_done", stream: "chat:conv:7", payload: { up_to_seq: 3 } })
    );
    expect(frame?.type).toBe("replay_done");
    expect(frame?.payload["up_to_seq"]).toBe(3);
    expect(decodeFrame("{not json")).toBeNull();
  });
});
