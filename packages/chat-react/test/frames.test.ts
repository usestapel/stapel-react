/**
 * CHAT'S PAYLOADS, read off the substrate's envelope.
 *
 * The protocol is not tested here — `@stapel/realtime` owns it and tests it
 * once for the fleet. What is tested here is the only thing left that can be
 * wrong in this package: whether chat's own payloads are read correctly, and
 * whether the two sequences stay apart.
 *
 * Every frame below is built the way the server builds it
 * (`stapel_realtime.envelope.frame`, `stapel_chat.realtime.message_payload`),
 * not the way the reader hopes to receive it.
 */
import { describe, expect, it } from "vitest";
import { decodeFrame } from "@stapel/realtime";
import type { RealtimeFrame } from "@stapel/realtime";
import {
  CHAT_SIGNAL_ACTIVITY,
  CHAT_SIGNAL_DELIVERED,
  CHAT_SIGNAL_INBOX,
  CHAT_SIGNAL_READ,
  chatClientMessageId,
  isChatMessageFrame,
  readChatActivityFrame,
  readChatInboxFrame,
  readChatMarkerFrame,
  readChatMessageFrame,
} from "../src/index.js";
import { chatMessagePayload } from "./chatServer.js";
import { CONVERSATION_ID } from "./fixtures.js";

function envelope(
  type: string,
  payload: Record<string, unknown>,
  seq?: number
): RealtimeFrame {
  const raw: Record<string, unknown> = {
    v: 1,
    type,
    stream: `chat:conv:${CONVERSATION_ID}`,
    payload,
  };
  if (seq !== undefined) raw["seq"] = seq;
  const frame = decodeFrame(JSON.stringify(raw));
  if (frame === null) throw new Error(`the substrate could not decode a ${type}`);
  return frame;
}

describe("a message payload, off a journal frame", () => {
  it("reads a live message field for field", () => {
    const frame = envelope(
      "live",
      chatMessagePayload({ seq: 7, conversationId: CONVERSATION_ID }),
      7
    );
    expect(isChatMessageFrame(frame)).toBe(true);
    expect(readChatMessageFrame(frame)).toEqual({
      message_id: "m-7",
      conversation_id: CONVERSATION_ID,
      sender_id: "u-seller",
      seq: 7,
      rev_seq: 7,
      kind: "text",
      body: "message 7",
      reply_to: null,
      attachments: [],
      client_msg_id: null,
      edited: false,
      edited_at: null,
      deleted: false,
      deleted_at: null,
      created_at: "2026-08-26T18:20:00+00:00",
    });
  });

  it("reads a replay frame identically — the same frame either way", () => {
    const frame = envelope(
      "replay",
      chatMessagePayload({ seq: 2, conversationId: CONVERSATION_ID }),
      2
    );
    expect(readChatMessageFrame(frame)?.seq).toBe(2);
  });

  it("keeps rev_seq and seq apart, in both directions", () => {
    // An edit: same place in the thread, new place in the revision journal.
    const frame = envelope(
      "live",
      chatMessagePayload({
        seq: 2,
        revSeq: 9,
        conversationId: CONVERSATION_ID,
        edited: true,
      }),
      9
    );
    expect(frame.payloadSeq).toBe(2);
    expect(frame.envelopeSeq).toBe(9);
    const message = readChatMessageFrame(frame);
    expect(message?.seq).toBe(2);
    expect(message?.rev_seq).toBe(9);
  });

  it("falls back to the ENVELOPE seq for rev_seq, never to the payload's seq", () => {
    // `deliver_frame(stream, payload, seq=msg.rev_seq)` — on a journal frame
    // the two are the same number by construction, so a payload that omits
    // `rev_seq` (a 0.5.x server) still resumes correctly. Reaching for
    // `payload.seq` here is the confusion the whole cutover exists to end.
    const payload = chatMessagePayload({ seq: 2, conversationId: CONVERSATION_ID });
    delete (payload as Record<string, unknown>)["rev_seq"];
    const message = readChatMessageFrame(envelope("live", payload, 9));
    expect(message?.rev_seq).toBe(9);
    expect(message?.seq).toBe(2);
  });

  it("a tombstone is a message, not an absence", () => {
    const message = readChatMessageFrame(
      envelope(
        "live",
        chatMessagePayload({ seq: 3, revSeq: 8, conversationId: CONVERSATION_ID, deleted: true }),
        8
      )
    );
    expect(message).toMatchObject({
      message_id: "m-3",
      seq: 3,
      rev_seq: 8,
      body: "",
      attachments: [],
      deleted: true,
    });
  });

  it("carries client_msg_id back, so an optimistic bubble can be reconciled", () => {
    const message = readChatMessageFrame(
      envelope(
        "live",
        chatMessagePayload({
          seq: 4,
          conversationId: CONVERSATION_ID,
          clientMsgId: "cmid-42",
        }),
        4
      )
    );
    expect(message?.client_msg_id).toBe("cmid-42");
  });

  it("refuses a payload it cannot read rather than inventing half a message", () => {
    // A half-read row in the store is worse than none: nothing can reconcile
    // it with the REST answer for the same id.
    expect(readChatMessageFrame(envelope("live", { message_id: "m-1" }, 1))).toBeNull();
    expect(readChatMessageFrame(envelope("welcome", { server_seq: 9 }))).toBeNull();
    expect(readChatMessageFrame(envelope("replay_done", { up_to_seq: 9 }))).toBeNull();
  });
});

describe("signals — the module's own frame types, structurally without a seq", () => {
  it("chat.read and chat.delivered normalize onto one marker shape", () => {
    const read = readChatMarkerFrame(
      envelope(CHAT_SIGNAL_READ, {
        conversation_id: CONVERSATION_ID,
        user_id: "u-buyer",
        last_read_seq: 5,
      })
    );
    expect(read).toEqual({
      conversation_id: CONVERSATION_ID,
      user_id: "u-buyer",
      seq: 5,
    });
    const delivered = readChatMarkerFrame(
      envelope(CHAT_SIGNAL_DELIVERED, {
        conversation_id: CONVERSATION_ID,
        user_id: "u-buyer",
        last_delivered_seq: 6,
      })
    );
    expect(delivered?.seq).toBe(6);
  });

  it("chat.activity carries the client's own expiry hint", () => {
    const activity = readChatActivityFrame(
      envelope(CHAT_SIGNAL_ACTIVITY, {
        conversation_id: CONVERSATION_ID,
        user_id: "u-seller",
        state: "typing",
        ttl_s: 6,
      })
    );
    expect(activity).toEqual({
      conversation_id: CONVERSATION_ID,
      user_id: "u-seller",
      state: "typing",
      ttl_s: 6,
    });
  });

  it("chat.inbox carries the whole message, and a signal never has a seq", () => {
    const frame = envelope(CHAT_SIGNAL_INBOX, {
      conversation_id: CONVERSATION_ID,
      conversation_kind: "direct",
      last_seq: 12,
      message: chatMessagePayload({ seq: 12, conversationId: CONVERSATION_ID }),
    });
    expect(frame.envelopeSeq).toBeUndefined();
    expect(frame.signal).toBe(true);
    const inbox = readChatInboxFrame(frame);
    expect(inbox?.last_seq).toBe(12);
    expect(inbox?.message?.message_id).toBe("m-12");
  });

  it("a reader answers null for a frame that is not its own", () => {
    const live = envelope("live", chatMessagePayload({ seq: 1, conversationId: CONVERSATION_ID }), 1);
    expect(readChatMarkerFrame(live)).toBeNull();
    expect(readChatActivityFrame(live)).toBeNull();
    expect(readChatInboxFrame(live)).toBeNull();
  });
});

describe("the idempotency key", () => {
  it("is unique per call, and non-empty in an environment without crypto", () => {
    const keys = new Set(Array.from({ length: 50 }, () => chatClientMessageId()));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key.length).toBeGreaterThan(8);
  });
});
