/**
 * The protocol mirror. Every assertion here is against a frame shape taken
 * from stapel-chat's own source (`consumers.py`, `realtime.py`) rather than
 * from what this client would like to receive — a mirror that agrees with
 * itself proves nothing.
 */
import { describe, expect, it } from "vitest";
import {
  CHAT_WS_CLOSE_NOT_PARTICIPANT,
  CHAT_WS_CLOSE_UNAUTHENTICATED,
  CHAT_WS_REPLAY_LIMIT,
  CHAT_WS_RESYNC,
  decodeServerFrame,
  parseServerFrame,
} from "../src/index.js";
import { messageFrame } from "./fixtures.js";

describe("server → client frames", () => {
  it("welcome carries the conversation and the server's high-water mark", () => {
    const frame = parseServerFrame({
      type: "welcome",
      conversation_id: "c-1",
      server_seq: 42,
    });
    expect(frame).toEqual({
      type: "welcome",
      conversation_id: "c-1",
      server_seq: 42,
    });
  });

  it("message is `realtime.message_frame`, field for field", () => {
    const frame = parseServerFrame(messageFrame(7, "hello"));
    expect(frame).toMatchObject({
      type: "message",
      message_id: "m-7",
      seq: 7,
      kind: "text",
      body: "hello",
      sender_id: "u-seller",
      reply_to: null,
      attachments: [],
    });
  });

  it("a system message's null sender survives the parse", () => {
    const frame = parseServerFrame({
      ...(messageFrame(1) as Record<string, unknown>),
      sender_id: null,
      kind: "system",
    });
    expect(frame).toMatchObject({ kind: "system", sender_id: null });
  });

  it("replay_done reports where the replay stopped", () => {
    expect(parseServerFrame({ type: "replay_done", up_to_seq: 9 })).toEqual({
      type: "replay_done",
      up_to_seq: 9,
    });
  });

  it("error carries the socket-local code, resync included", () => {
    expect(
      parseServerFrame({
        type: "error",
        code: CHAT_WS_RESYNC,
        message: "resume gap 900 exceeds window 500",
      })
    ).toEqual({
      type: "error",
      code: "resync",
      message: "resume gap 900 exceeds window 500",
    });
  });

  it("pong is a bare frame", () => {
    expect(parseServerFrame({ type: "pong" })).toEqual({ type: "pong" });
  });
});

describe("the wire is untrusted", () => {
  it("an unknown frame type is dropped, not coerced", () => {
    expect(parseServerFrame({ type: "typing", user: "x" })).toBeNull();
  });

  it("a message with no numeric seq is dropped — it must never advance the cursor", () => {
    const frame = messageFrame(3) as Record<string, unknown>;
    expect(parseServerFrame({ ...frame, seq: "3" })).toBeNull();
    expect(parseServerFrame({ ...frame, seq: undefined })).toBeNull();
  });

  it("a message missing its identity is dropped", () => {
    const frame = messageFrame(3) as Record<string, unknown>;
    expect(parseServerFrame({ ...frame, message_id: undefined })).toBeNull();
    expect(parseServerFrame({ ...frame, created_at: 17 })).toBeNull();
  });

  it("non-objects and non-JSON are dropped", () => {
    expect(parseServerFrame(null)).toBeNull();
    expect(parseServerFrame("hello")).toBeNull();
    expect(decodeServerFrame("{not json")).toBeNull();
    expect(decodeServerFrame(new ArrayBuffer(4))).toBeNull();
  });

  it("decodes the JSON text a socket actually delivers", () => {
    expect(decodeServerFrame(JSON.stringify({ type: "pong" }))).toEqual({
      type: "pong",
    });
  });
});

describe("mirrored constants", () => {
  it("match the module's own", () => {
    // consumers.REPLAY_LIMIT / close codes in ChatConsumer.connect().
    expect(CHAT_WS_REPLAY_LIMIT).toBe(500);
    expect(CHAT_WS_CLOSE_UNAUTHENTICATED).toBe(4401);
    expect(CHAT_WS_CLOSE_NOT_PARTICIPANT).toBe(4403);
  });
});
