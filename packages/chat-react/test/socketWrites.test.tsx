/**
 * CHAT'S SOCKET-WRITE SEAM — the substrate's one documented exception, and
 * the frames it actually puts on the wire.
 *
 * Every other pair writes over REST. Chat does not, because the owner's
 * ruling is that a chat client gets a full WebSocket and a compose box whose
 * Enter key takes a different transport than the messages it produces is the
 * seam where "realtime was built" stops being true.
 *
 * Two things are worth testing about a write frame, and they are both here:
 * the ENVELOPE that leaves the socket (asserted through the real transport,
 * not a recorder standing in front of it), and the `client_msg_id` that makes
 * a retry idempotent rather than a second bubble.
 */
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chatConversationStream,
  createChatSocketWrites,
  useChatFreshness,
} from "../src/index.js";
import type { ChatSocketWrites } from "../src/index.js";
import { ChatServer, TestHarness, installBrowserWebSocket, mockServer } from "./harness.js";
import type { BrowserWebSocketEnvironment } from "./harness.js";
import { CONVERSATION_ID } from "./fixtures.js";

const STREAM = chatConversationStream(CONVERSATION_ID);

describe("the six frames, bound to a sender", () => {
  function recorder(): {
    sent: { type: string; payload: Record<string, unknown> | undefined }[];
    writes: ChatSocketWrites;
  } {
    const sent: { type: string; payload: Record<string, unknown> | undefined }[] = [];
    const writes = createChatSocketWrites((type, payload) => {
      sent.push({ type, payload: payload as Record<string, unknown> | undefined });
      return true;
    }, true);
    return { sent, writes };
  }

  it("send carries a client_msg_id and hands it back", () => {
    const { sent, writes } = recorder();
    const result = writes.send("hello", { replyTo: "m-2" });
    expect(result.sent).toBe(true);
    expect(result.clientMsgId).toBeTruthy();
    expect(sent[0]?.type).toBe("send");
    expect(sent[0]?.payload).toEqual({
      body: "hello",
      client_msg_id: result.clientMsgId,
      reply_to: "m-2",
    });
  });

  it("a caller's own key is used verbatim — that is what makes a RETRY idempotent", () => {
    const { sent, writes } = recorder();
    writes.send("hello", { clientMsgId: "cmid-42" });
    writes.send("hello", { clientMsgId: "cmid-42" });
    expect(sent.map((frame) => frame.payload?.["client_msg_id"])).toEqual([
      "cmid-42",
      "cmid-42",
    ]);
  });

  it("edit, delete, read, delivered and activity name their own payloads", () => {
    const { sent, writes } = recorder();
    writes.edit("m-3", "fixed");
    writes.remove("m-4");
    writes.markRead(12);
    writes.markDelivered(13);
    writes.announceActivity("typing");
    expect(sent).toEqual([
      { type: "edit", payload: { message_id: "m-3", body: "fixed" } },
      { type: "delete", payload: { message_id: "m-4" } },
      { type: "read", payload: { upto_seq: 12 } },
      { type: "delivered", payload: { upto_seq: 13 } },
      { type: "activity", payload: { state: "typing" } },
    ]);
  });

  it("says so when there is no socket, instead of pretending it wrote", () => {
    const writes = createChatSocketWrites(() => false, false);
    expect(writes.available).toBe(false);
    expect(writes.send("hello")).toEqual({ clientMsgId: null, sent: false });
    expect(writes.markRead(3)).toBe(false);
  });
});

// ── through the real socket ──────────────────────────────────────────────────

let env: BrowserWebSocketEnvironment;

beforeEach(() => {
  env = installBrowserWebSocket();
});

afterEach(() => {
  env.restore();
});

let captured: ChatSocketWrites | null = null;

function Writer(): React.ReactElement {
  const freshness = useChatFreshness(STREAM, () => [], { fallbackRefetchInterval: 0 });
  captured = createChatSocketWrites(freshness.send, freshness.transport === "socket");
  return <span data-testid="transport">{freshness.transport}</span>;
}

describe("what actually leaves the socket", () => {
  it("is a v1 envelope, stamped with this stream", async () => {
    captured = null;
    render(
      <TestHarness server={mockServer({})} realtime={{ socketUrl: "wss://chat.test" }}>
        <Writer />
      </TestHarness>
    );
    await waitFor(() => expect(env.sockets.length).toBe(1));
    const consumer = new ChatServer(env.last(), { stream: STREAM.key });
    act(() => {
      consumer.accept();
    });
    await waitFor(() => expect(captured?.available).toBe(true));

    act(() => {
      captured?.send("hello", { clientMsgId: "cmid-7" });
    });
    const frame = env.last().received("send")[0];
    expect(frame).toEqual({
      v: 1,
      type: "send",
      stream: STREAM.key,
      payload: { body: "hello", client_msg_id: "cmid-7" },
    });
    // The server accepted it as a frame it owns — a `bad_type` error would
    // mean the pair invented a name the consumer does not answer to.
    act(() => {
      consumer.pump();
    });
    expect(consumer.outbox.filter((out) => out.type === "error")).toEqual([]);
  });
});
