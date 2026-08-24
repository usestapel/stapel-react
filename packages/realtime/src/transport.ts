/**
 * The transport seam: what "a socket" means to this package, and the browser
 * implementation of it.
 *
 * **The browser handshake carries no header.** `new WebSocket(url)` has no API
 * for one — a page cannot set `Authorization`, and any client library that
 * "authenticates" a socket that way has only ever been tested outside a
 * browser. What a browser DOES send is its cookies, automatically, on the
 * handshake, and `stapel_core.django.jwt.channels` reads them (channel 4)
 * behind an origin allowlist. So the default factory below opens the socket
 * with exactly one argument and adds nothing to it.
 *
 * A non-browser host (a service, a native app, a test rig) that holds a token
 * passes {@link bearerSubprotocols} as `protocols`; the same middleware reads
 * the `Sec-WebSocket-Protocol` pair as channel 2. A token in the QUERY STRING
 * is supported by the server and deliberately NOT offered here: query strings
 * land in proxy access logs.
 *
 * Origin is the server's problem, not ours — a browser stamps `Origin` itself
 * and a page cannot forge it. Nothing in this package tries to.
 */

/** Callbacks the transport hands back to the runtime. */
export interface RealtimeSocketHandlers {
  readonly onOpen: () => void;
  /** One inbound message body (the `data` of a message event). */
  readonly onData: (data: unknown) => void;
  readonly onClose: (code: number, reason: string) => void;
  readonly onError: () => void;
}

/** What the runtime needs from a socket: send text, close. */
export interface RealtimeSocket {
  send(payload: string): void;
  close(): void;
}

/**
 * Opens one socket. Injectable so tests drive the protocol without a network,
 * and so a host can wrap it (instrumentation, a proxy, React Native).
 *
 * Handlers fire ASYNCHRONOUSLY, as a real `WebSocket`'s do — the factory must
 * have returned before `onOpen` runs.
 */
export type RealtimeSocketFactory = (
  url: string,
  handlers: RealtimeSocketHandlers,
  protocols?: readonly string[]
) => RealtimeSocket;

/**
 * Wrap a token as the `Sec-WebSocket-Protocol` pair
 * `stapel_core.django.jwt.channels` accepts (`["bearer", "<jwt>"]`).
 *
 * For NON-browser hosts. A browser page authenticates with its httpOnly
 * cookie: it has no way to read the token, and handing one to JavaScript so it
 * can be put in a subprotocol is a downgrade, not a feature.
 */
export function bearerSubprotocols(token: string): readonly string[] {
  return ["bearer", token];
}

/**
 * The browser transport. `addEventListener` rather than the `on*` properties,
 * so the structural contract above stays independent of the DOM `WebSocket`
 * type and a host wrapper can be a plain object.
 */
export function browserSocketFactory(
  url: string,
  handlers: RealtimeSocketHandlers,
  protocols?: readonly string[]
): RealtimeSocket {
  // One argument in the cookie case. There is no header to add, and nothing
  // is appended to the URL — see the file header.
  const socket =
    protocols === undefined || protocols.length === 0
      ? new WebSocket(url)
      : new WebSocket(url, [...protocols]);
  socket.addEventListener("open", () => {
    handlers.onOpen();
  });
  socket.addEventListener("message", (event: MessageEvent<unknown>) => {
    handlers.onData(event.data);
  });
  socket.addEventListener("close", (event: CloseEvent) => {
    handlers.onClose(event.code, event.reason);
  });
  socket.addEventListener("error", () => {
    handlers.onError();
  });
  return {
    send: (payload: string) => {
      socket.send(payload);
    },
    close: () => {
      socket.close();
    },
  };
}

/** True when this environment can open a socket at all (SSR/node cannot). */
export function canOpenWebSocket(): boolean {
  return typeof WebSocket !== "undefined";
}

/**
 * Turn a module's runtime HTTP `baseUrl` into the socket origin beside it:
 * `https://host/chat/api/v1/` → `wss://host`. The path is the caller's — chat
 * rows carry their own `socket_path`, and inventing one here would be this
 * package guessing at a module's routing.
 */
export function socketOrigin(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  parsed.protocol = parsed.protocol === "http:" ? "ws:" : "wss:";
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}
