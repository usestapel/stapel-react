/**
 * Where the socket is, derived from where the API is — and every way that
 * derivation is allowed to answer "nowhere", which is the answer that makes
 * the pair work on a WSGI deployment.
 */
import { describe, expect, it } from "vitest";
import {
  chatConversationStream,
  chatInboxStream,
  chatSocketUrl,
  chatStreamId,
  createChatRuntime,
  deriveChatSocketBase,
} from "../src/index.js";

describe("deriving the socket base from the REST base", () => {
  it("https becomes wss, at the host root — the module's canonical mount", () => {
    // stapel_chat.routing mounts `ws/chat/<uuid>` in the host's ASGI app, not
    // under the module's /chat/api prefix.
    expect(deriveChatSocketBase("https://darom.example/chat/api/v1")).toBe(
      "wss://darom.example/ws/chat/"
    );
  });

  it("http becomes ws", () => {
    expect(deriveChatSocketBase("http://localhost:8000/chat/api/v1")).toBe(
      "ws://localhost:8000/ws/chat/"
    );
  });

  it("a relative base is resolved against the page's origin", () => {
    expect(deriveChatSocketBase("/chat/api/v1", "https://shop.example")).toBe(
      "wss://shop.example/ws/chat/"
    );
  });

  it("a relative base with NO origin answers null — SSR has no socket", () => {
    expect(deriveChatSocketBase("/chat/api/v1", null)).toBeNull();
  });
});

describe("stream keys", () => {
  it("a conversation stream resolves to the mounted path", () => {
    expect(
      chatSocketUrl("wss://x.example/ws/chat/", chatConversationStream("c-1"))
    ).toBe("wss://x.example/ws/chat/c-1");
  });

  it("tolerates a base without its trailing slash", () => {
    expect(chatSocketUrl("wss://x.example/ws/chat", chatConversationStream("c-1"))).toBe(
      "wss://x.example/ws/chat/c-1"
    );
  });

  it("the INBOX has no socket — the module fans out per thread, not per user", () => {
    expect(chatSocketUrl("wss://x.example/ws/chat/", chatInboxStream())).toBeNull();
  });

  it("a null base means no socket for anything", () => {
    expect(chatSocketUrl(null, chatConversationStream("c-1"))).toBeNull();
  });

  it("ids are stable strings a dependency list can compare", () => {
    expect(chatStreamId(chatConversationStream("c-1"))).toBe("conversation:c-1");
    expect(chatStreamId(chatInboxStream())).toBe("inbox");
  });
});

describe("the runtime resolves the transport once", () => {
  it("derives from baseUrl by default", () => {
    const runtime = createChatRuntime({
      baseUrl: "https://darom.example/chat/api/v1",
      fetch: (() => Promise.reject(new Error("unused"))) as typeof globalThis.fetch,
    });
    expect(runtime.realtime.socketBase).toBe("wss://darom.example/ws/chat/");
  });

  it("an explicit null turns the socket half OFF — what a WSGI host says", () => {
    const runtime = createChatRuntime({
      baseUrl: "https://darom.example/chat/api/v1",
      fetch: (() => Promise.reject(new Error("unused"))) as typeof globalThis.fetch,
      realtime: { socketUrl: null },
    });
    expect(runtime.realtime.socketBase).toBeNull();
  });

  it("an explicit URL wins — a separate ASGI host is a normal deployment", () => {
    const runtime = createChatRuntime({
      baseUrl: "https://darom.example/chat/api/v1",
      fetch: (() => Promise.reject(new Error("unused"))) as typeof globalThis.fetch,
      realtime: { socketUrl: "wss://sockets.darom.example/ws/chat/" },
    });
    expect(runtime.realtime.socketBase).toBe("wss://sockets.darom.example/ws/chat/");
  });
});
