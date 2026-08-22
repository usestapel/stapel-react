/**
 * A socket the test drives by hand: the transport seam's injectable factory,
 * implemented over plain callbacks so a suite can deliver the exact frames
 * `stapel_chat.consumers.ChatConsumer` sends, in the exact order, without a
 * network.
 */
import type {
  ChatSocketConnection,
  ChatSocketHandlers,
  ChatWebSocketFactory,
} from "../src/index.js";

export { messageFrame } from "./fixtures.js";

/** One socket the code under test opened. */
export interface FakeSocket {
  readonly url: string;
  /** Every payload the client sent, decoded. */
  readonly sent: unknown[];
  /** Whether the client closed this connection. */
  closed: boolean;
  /** Make the next `send` throw — a socket that died between frames. */
  throwOnSend: boolean;
  /** The handshake completed. */
  open(): void;
  /** Server → client: one frame, JSON-encoded exactly as the consumer sends it. */
  emit(frame: unknown): void;
  /** Server → client: a raw payload (the malformed-frame cases). */
  emitRaw(data: unknown): void;
  /** The socket dropped with this close code. */
  serverClose(code: number): void;
  /** The transport reported an error (always followed by a close, as in a browser). */
  serverError(): void;
}

export interface FakeTransport {
  readonly factory: ChatWebSocketFactory;
  /** Every socket opened, in order — index 1 is the first reconnect. */
  readonly sockets: FakeSocket[];
  readonly last: () => FakeSocket;
}

export function fakeTransport(): FakeTransport {
  const sockets: FakeSocket[] = [];
  const factory: ChatWebSocketFactory = (
    url: string,
    handlers: ChatSocketHandlers
  ): ChatSocketConnection => {
    const socket: FakeSocket = {
      url,
      sent: [],
      closed: false,
      throwOnSend: false,
      open: () => handlers.onOpen(),
      emit: (frame) => handlers.onData(JSON.stringify(frame)),
      emitRaw: (data) => handlers.onData(data),
      serverClose: (code) => handlers.onClose(code),
      serverError: () => handlers.onError(),
    };
    sockets.push(socket);
    return {
      send: (payload) => {
        if (socket.throwOnSend) throw new Error("socket is closed");
        socket.sent.push(JSON.parse(payload) as unknown);
      },
      close: () => {
        socket.closed = true;
      },
    };
  };
  return {
    factory,
    sockets,
    last: () => {
      const socket = sockets[sockets.length - 1];
      if (!socket) throw new Error("no socket was opened");
      return socket;
    },
  };
}
