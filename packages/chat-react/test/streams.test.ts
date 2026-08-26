/**
 * THE TWO STREAM KEYS, and where their sockets are.
 *
 * The keys are not this pair's invention: the server stamps them on every
 * envelope (`stapel_chat.realtime.conversation_stream` / `user_stream`) and
 * the substrate ROUTES on them. A client that subscribes under a key the
 * server does not use gets a socket that delivers nothing, silently — which
 * is the same failure mode as the protocol mismatch this cutover fixed, one
 * level down.
 *
 * Until this change `streams.ts` also declared that the inbox has NO socket.
 * `stapel_chat.routing` has mounted `ws/chat/inbox` since 0.4.0.
 */
import { describe, expect, it } from "vitest";
import {
  CHAT_INBOX_SOCKET_PATH,
  chatConversationStream,
  chatConversationStreamKey,
  chatInboxStream,
  chatSocketUrl,
  chatSocketUrlForStreamKey,
  chatStreamForConversation,
  chatUserStreamKey,
  deriveChatSocketOrigin,
} from "../src/index.js";
import { CONVERSATION_ID, conversation } from "./fixtures.js";

describe("stream keys mirror stapel_chat.realtime", () => {
  it("a conversation is chat:conv:<id>, resumable", () => {
    const stream = chatConversationStream(CONVERSATION_ID);
    expect(stream.key).toBe(`chat:conv:${CONVERSATION_ID}`);
    expect(chatConversationStreamKey(CONVERSATION_ID)).toBe(stream.key);
    expect(stream.path).toBe(`ws/chat/${CONVERSATION_ID}`);
    expect(stream.journal).toBe(true);
    expect(stream.conversationId).toBe(CONVERSATION_ID);
  });

  it("an inbox is chat:user:<id> at ONE mount, and is ephemeral", () => {
    const stream = chatInboxStream("u-buyer");
    expect(stream.key).toBe("chat:user:u-buyer");
    expect(chatUserStreamKey("u-buyer")).toBe(stream.key);
    // The route carries no user segment — the consumer derives the key from
    // the authenticated scope, so there is nothing in the URL to tamper with.
    expect(stream.path).toBe(CHAT_INBOX_SOCKET_PATH);
    expect(stream.path).toBe("ws/chat/inbox");
    expect(stream.journal).toBe(false);
    expect(stream.conversationId).toBeUndefined();
  });
});

describe("the SERVER's own answer wins over anything derived here", () => {
  it("a conversation row's stream_key and socket_path are used as given", () => {
    const row = conversation({
      stream_key: "chat:conv:from-the-server",
      socket_path: "ws/chat/from-the-server",
    });
    const stream = chatStreamForConversation(row);
    expect(stream.key).toBe("chat:conv:from-the-server");
    expect(stream.path).toBe("ws/chat/from-the-server");
  });

  it("falls back to the derived pair when the row omits them", () => {
    // The server populates both on every conversation it serves, but they are
    // absent from the schema's `required` list, so the generated type makes
    // them optional and this branch is for an absence the pinned server never
    // produces (and for a host still on 0.3.x). Reported upstream.
    const row = conversation();
    delete (row as { stream_key?: string }).stream_key;
    delete (row as { socket_path?: string }).socket_path;
    const stream = chatStreamForConversation(row);
    expect(stream.key).toBe(`chat:conv:${CONVERSATION_ID}`);
    expect(stream.path).toBe(`ws/chat/${CONVERSATION_ID}`);
  });
});

describe("the socket origin, and the URL a stream resolves to", () => {
  it("derives wss:// from an https base, ORIGIN only — the path is the stream's", () => {
    expect(deriveChatSocketOrigin("https://shop.example/chat/api/v1/")).toBe(
      "wss://shop.example"
    );
    expect(deriveChatSocketOrigin("http://localhost:8000/chat/api/v1/")).toBe(
      "ws://localhost:8000"
    );
  });

  it("resolves a relative base against the page's origin", () => {
    expect(deriveChatSocketOrigin("/chat/api/v1/", "https://shop.example")).toBe(
      "wss://shop.example"
    );
  });

  it("answers null when no origin can be resolved — SSR, a node runner", () => {
    expect(deriveChatSocketOrigin("/chat/api/v1/", null)).toBeNull();
    expect(chatSocketUrl(null, chatInboxStream("u-1"))).toBeNull();
  });

  it("joins origin and path without doubling the slash", () => {
    expect(chatSocketUrl("wss://shop.example/", chatInboxStream("u-1"))).toBe(
      "wss://shop.example/ws/chat/inbox"
    );
    expect(chatSocketUrl("wss://shop.example", chatConversationStream("c-1"))).toBe(
      "wss://shop.example/ws/chat/c-1"
    );
  });
});

describe("the resolver the provider hands the substrate", () => {
  it("maps a raw stream key back to its mount", () => {
    expect(chatSocketUrlForStreamKey("wss://s.test", `chat:conv:${CONVERSATION_ID}`)).toBe(
      `wss://s.test/ws/chat/${CONVERSATION_ID}`
    );
    expect(chatSocketUrlForStreamKey("wss://s.test", "chat:user:u-1")).toBe(
      "wss://s.test/ws/chat/inbox"
    );
  });

  it("answers null for a key this module does not own", () => {
    expect(chatSocketUrlForStreamKey("wss://s.test", "video:room:7")).toBeNull();
    expect(chatSocketUrlForStreamKey("wss://s.test", "chat:unknown:7")).toBeNull();
    expect(chatSocketUrlForStreamKey("wss://s.test", "chat:conv:")).toBeNull();
  });
});
