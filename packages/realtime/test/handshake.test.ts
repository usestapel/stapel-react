/**
 * The handshake, in the shape a BROWSER can actually perform.
 *
 * This is the test the pre-substrate stack did not have, and its absence is
 * the whole of §83.1: the socket was built, mounted, proxied and smoke-tested
 * with an `Authorization` header — which `new WebSocket()` has no API for and
 * a page can never send. The only path that mattered (the httpOnly cookie the
 * browser attaches by itself) was therefore never exercised, every real
 * handshake closed 4401, and the product ran on polling for months.
 *
 * So: the default transport must open the socket with the URL and NOTHING
 * else. No header, no `?token=`, no subprotocol. Cookies ride the handshake
 * because the browser puts them there; the origin check is the server's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bearerSubprotocols, browserSocketFactory, canOpenWebSocket, socketOrigin } from "../src/index.js";

interface Construction {
  readonly args: unknown[];
}

const constructions: Construction[] = [];

class RecordingWebSocket {
  public static readonly OPEN = 1;
  constructor(...args: unknown[]) {
    constructions.push({ args });
  }
  addEventListener(): void {
    /* the runtime attaches four; none of them carry credentials */
  }
  send(): void {}
  close(): void {}
}

let original: unknown;

beforeEach(() => {
  constructions.length = 0;
  original = (globalThis as Record<string, unknown>)["WebSocket"];
  (globalThis as Record<string, unknown>)["WebSocket"] = RecordingWebSocket;
});

afterEach(() => {
  (globalThis as Record<string, unknown>)["WebSocket"] = original;
});

const handlers = {
  onOpen: vi.fn(),
  onData: vi.fn(),
  onClose: vi.fn(),
  onError: vi.fn(),
};

describe("browser handshake", () => {
  it("opens with the URL alone — no second argument at all", () => {
    browserSocketFactory("wss://api.example.test/ws/chat/7", handlers);
    expect(constructions).toHaveLength(1);
    expect(constructions[0]?.args).toEqual(["wss://api.example.test/ws/chat/7"]);
  });

  it("puts no credential anywhere in the handshake it controls", () => {
    browserSocketFactory("wss://api.example.test/ws/chat/7", handlers);
    const serialized = JSON.stringify(constructions[0]?.args ?? []).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("bearer");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("cookie");
  });

  it("passes a subprotocol ONLY when a non-browser host supplies one", () => {
    // `stapel_core.django.jwt.channels` channel 2: ["bearer", "<jwt>"].
    browserSocketFactory("wss://svc.example.test/ws/chat/7", handlers, bearerSubprotocols("jwt-abc"));
    expect(constructions[0]?.args).toEqual([
      "wss://svc.example.test/ws/chat/7",
      ["bearer", "jwt-abc"],
    ]);
  });

  it("treats an empty protocol list as no protocol (not an empty array)", () => {
    browserSocketFactory("wss://api.example.test/ws/chat/7", handlers, []);
    expect(constructions[0]?.args).toHaveLength(1);
  });

  it("knows when the environment cannot open a socket at all", () => {
    expect(canOpenWebSocket()).toBe(true);
    (globalThis as Record<string, unknown>)["WebSocket"] = undefined;
    expect(canOpenWebSocket()).toBe(false);
  });
});

describe("socketOrigin", () => {
  it("derives the ws origin from a module's http base url", () => {
    expect(socketOrigin("https://api.example.test/chat/api/v1/")).toBe(
      "wss://api.example.test"
    );
    expect(socketOrigin("http://localhost:8000/chat/api/v1/")).toBe(
      "ws://localhost:8000"
    );
  });
});
