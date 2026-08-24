/**
 * A `WebSocket` double at the ENVIRONMENT edge — `globalThis.WebSocket`, the
 * thing the browser provides — not at the pair's injectable factory seam.
 *
 * WHY THIS FILE EXISTS (CONTRIBUTING.md, "Mock the wire, not the module").
 *
 * `test/harnessSocket.ts` injects a `ChatWebSocketFactory`. Everything it
 * covers is real — the handshake frames, the seq dedup, the resync, the
 * backoff — but it stands EXACTLY where `browserWebSocketFactory` would
 * stand, so 100% of those tests bypass the one line that decides whether a
 * credential reaches the server:
 *
 *     new WebSocket(url)            ← no credential. Every handshake 4401.
 *     new WebSocket(url, protocols) ← the browser's only header-free channel.
 *
 * A browser cannot set an `Authorization` header on a WebSocket. The token
 * therefore has to travel in the URL or the subprotocol list, and the only
 * thing that can put it there is the code that CONSTRUCTS the socket. A test
 * that replaces that code cannot see the difference — which is why a suite of
 * eighteen green socket tests coexisted with a chat that had never once
 * authenticated a socket in production. (The backend's own smoke test had the
 * mirror-image defect: it sent an `Authorization` header a browser can never
 * send.)
 *
 * So this double records what the CONSTRUCTOR was called with, and the tests
 * assert on that.
 */

/** One `new WebSocket(...)` the code under test performed. */
export interface ConstructedSocket {
  /** First constructor argument, verbatim (credential-in-query lands here). */
  readonly url: string;
  /**
   * Second constructor argument, verbatim — `undefined` when the client
   * called `new WebSocket(url)` with one argument, which is the cookie
   * channel and NOT the same thing as an empty list.
   */
  readonly protocols: string | readonly string[] | undefined;
  /** Payloads the client sent, decoded. */
  readonly sent: unknown[];
  /** The client called `close()` on this socket. */
  readonly closedByClient: boolean;
  /** The handshake completed. */
  open(): void;
  /** Server → client: one frame, JSON-encoded as the consumer sends it. */
  emit(frame: unknown): void;
  /** The socket closed with this code (a refusal, or a drop). */
  serverClose(code: number): void;
}

type Listener = (event: unknown) => void;

class BrowserWebSocketDouble implements ConstructedSocket {
  static readonly opened: BrowserWebSocketDouble[] = [];

  readonly sent: unknown[] = [];
  closedByClient = false;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(
    readonly url: string,
    readonly protocols?: string | readonly string[]
  ) {
    BrowserWebSocketDouble.opened.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  send(payload: string): void {
    this.sent.push(JSON.parse(payload) as unknown);
  }

  close(): void {
    this.closedByClient = true;
  }

  private fire(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  open(): void {
    this.fire("open", {});
  }

  emit(frame: unknown): void {
    this.fire("message", { data: JSON.stringify(frame) });
  }

  serverClose(code: number): void {
    this.fire("close", { code });
  }
}

export interface BrowserWebSocketEnvironment {
  /** Every socket constructed, in order — index 1 is the first reconnect. */
  readonly sockets: readonly ConstructedSocket[];
  readonly last: () => ConstructedSocket;
  /** Put the real (jsdom) `WebSocket` back. */
  restore(): void;
}

/**
 * Replace `globalThis.WebSocket` for the duration of a test. The code under
 * test is untouched: it still runs `browserWebSocketFactory`, still decides
 * what to construct, and this only records the constructor call.
 */
export function installBrowserWebSocket(): BrowserWebSocketEnvironment {
  const original = globalThis.WebSocket;
  BrowserWebSocketDouble.opened.length = 0;
  globalThis.WebSocket = BrowserWebSocketDouble as unknown as typeof WebSocket;
  return {
    sockets: BrowserWebSocketDouble.opened,
    last: () => {
      const socket =
        BrowserWebSocketDouble.opened[BrowserWebSocketDouble.opened.length - 1];
      if (!socket) throw new Error("no WebSocket was constructed");
      return socket;
    },
    restore: () => {
      globalThis.WebSocket = original;
      BrowserWebSocketDouble.opened.length = 0;
    },
  };
}
