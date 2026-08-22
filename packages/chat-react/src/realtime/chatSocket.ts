/**
 * A resumable client for stapel-chat's own socket protocol.
 *
 * The module is store-first and transport-thin: the socket never owns state,
 * it relays the durable `seq`-ordered journal (`consumers.py` header). This
 * client is the mirror image of that discipline —
 *
 *  - **resume, not subscribe.** Every (re)connect opens with
 *    `hello{last_seq}` carrying the seq the CONSUMER already holds, so the
 *    server replays exactly what was missed and then goes live. A reconnect
 *    after five seconds or five minutes is the same operation.
 *  - **idempotent by seq.** The server drops frames it has already sent; this
 *    client drops frames whose `seq` it has already surfaced. The
 *    replay/live overlap after a resume is therefore invisible to the
 *    consumer, on both ends of the wire.
 *  - **a gap is not a stall.** Past `REPLAY_LIMIT` the server answers
 *    `error{resync}`; this client forwards it verbatim and stops pretending
 *    to be up to date. Re-hydration is the consumer's job (it owns the REST
 *    history), which is what keeps correctness independent of delivery.
 *  - **a refusal is not a retry.** Close codes 4401 (unauthenticated) and
 *    4403 (not a participant) are answers, not faults: reconnecting would
 *    hammer the host with a question it already declined. Everything else is
 *    a fault and reconnects with exponential backoff + jitter.
 *
 * No React, no `@stapel/core`, no DOM assumptions beyond an injectable socket
 * factory — the future `@stapel/realtime` substrate is meant to replace this
 * file wholesale, so nothing above it may reach into it.
 */
import { decodeServerFrame } from "./frames.js";
import type { ChatServerFrame } from "./frames.js";
import {
  CHAT_WS_CLOSE_NOT_PARTICIPANT,
  CHAT_WS_CLOSE_UNAUTHENTICATED,
} from "./frames.js";

/**
 * Connection state, named as the realtime spec (§7) names it, so the
 * substrate migration is a rename of nothing.
 *
 *  - `connecting` — a socket is being opened (including a reconnect wait),
 *  - `open` — connected; frames are arriving,
 *  - `degraded` — the socket dropped and a reconnect is pending,
 *  - `closed` — it will not come back on its own (deliberate close, a
 *    refusal, or the retry budget spent).
 */
export type ChatConnectionState = "connecting" | "open" | "degraded" | "closed";

/** Why the socket will not come back. `undefined` while it still might. */
export type ChatSocketRefusal =
  | "unauthenticated"
  | "not_participant"
  | "unreachable";

export interface ChatSocketStatus {
  readonly state: ChatConnectionState;
  /** Set only in `closed`, and only when the reason is known. */
  readonly refusal: ChatSocketRefusal | undefined;
  /** Consecutive failed connects since the last `open`. */
  readonly attempt: number;
}

/** The callbacks the transport hands back to this client. */
export interface ChatSocketHandlers {
  readonly onOpen: () => void;
  /** One decoded payload (the `data` of a message event). */
  readonly onData: (data: unknown) => void;
  readonly onClose: (code: number) => void;
  readonly onError: () => void;
}

/** What a transport must offer: send text, close. */
export interface ChatSocketConnection {
  send(payload: string): void;
  close(): void;
}

/**
 * Opens one socket. Injectable so tests drive the protocol without a network
 * and a host can wrap the socket (instrumentation, a proxy, React Native).
 */
export type ChatWebSocketFactory = (
  url: string,
  handlers: ChatSocketHandlers
) => ChatSocketConnection;

/** Reconnect backoff knobs (exponential, jittered, capped). */
export interface ChatReconnectOptions {
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  /** Consecutive failures after which the socket gives up (and the caller
   * falls back to polling). Default 6. */
  readonly maxAttempts?: number;
}

/** Cancel handle for a scheduled callback. */
export type ChatCancel = () => void;

export interface ChatSocketOptions {
  /** Fully-qualified socket URL, e.g. `wss://host/ws/chat/<uuid>`. */
  readonly url: string;
  /**
   * The highest seq the CONSUMER holds, read afresh at every connect. A
   * function, not a value, because the consumer keeps advancing while the
   * socket is down — which is the whole point of resuming by seq.
   */
  readonly lastSeq: () => number;
  readonly onFrame: (frame: ChatServerFrame) => void;
  readonly onStatus: (status: ChatSocketStatus) => void;
  readonly webSocket?: ChatWebSocketFactory;
  readonly reconnect?: ChatReconnectOptions;
  /** Injectable timer (tests). Returns its own cancel. */
  readonly schedule?: (fn: () => void, ms: number) => ChatCancel;
  /** Injectable jitter source (tests). */
  readonly random?: () => number;
}

export interface ChatSocket {
  /** Current status (also pushed through `onStatus`). */
  status(): ChatSocketStatus;
  /** Acknowledge delivery up to `seq` (the server tracks it; nothing
   * depends on it — a dropped ack costs nothing). */
  ack(seq: number): void;
  /** Liveness probe. */
  ping(): void;
  /** Close deliberately: no reconnect, no further callbacks. */
  close(): void;
}

const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 6;

function defaultSchedule(fn: () => void, ms: number): ChatCancel {
  const handle = setTimeout(fn, ms);
  return () => {
    clearTimeout(handle);
  };
}

/**
 * The browser transport. Uses `addEventListener` rather than the `on*`
 * properties so the structural contract above stays independent of the DOM
 * `WebSocket` type (and so a host wrapper can be a plain object).
 */
export function browserWebSocketFactory(
  url: string,
  handlers: ChatSocketHandlers
): ChatSocketConnection {
  const socket = new WebSocket(url);
  socket.addEventListener("open", () => {
    handlers.onOpen();
  });
  socket.addEventListener("message", (event: MessageEvent<unknown>) => {
    handlers.onData(event.data);
  });
  socket.addEventListener("close", (event: CloseEvent) => {
    handlers.onClose(event.code);
  });
  socket.addEventListener("error", () => {
    handlers.onError();
  });
  return {
    send: (payload) => {
      socket.send(payload);
    },
    close: () => {
      socket.close();
    },
  };
}

/** True when the environment can open a socket at all (SSR / node cannot). */
export function canOpenWebSocket(): boolean {
  return typeof WebSocket !== "undefined";
}

function refusalFor(code: number): ChatSocketRefusal | undefined {
  if (code === CHAT_WS_CLOSE_UNAUTHENTICATED) return "unauthenticated";
  if (code === CHAT_WS_CLOSE_NOT_PARTICIPANT) return "not_participant";
  return undefined;
}

/**
 * Open a resumable conversation socket. Connects immediately; returns the
 * handle that closes it. Every state change is pushed through `onStatus`, so
 * a React layer can render the transport without polling this object.
 */
export function createChatSocket(options: ChatSocketOptions): ChatSocket {
  const factory = options.webSocket ?? browserWebSocketFactory;
  const schedule = options.schedule ?? defaultSchedule;
  const random = options.random ?? Math.random;
  const baseDelay = options.reconnect?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelay = options.reconnect?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const maxAttempts = options.reconnect?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  let connection: ChatSocketConnection | null = null;
  let cancelRetry: ChatCancel | null = null;
  let disposed = false;
  let attempt = 0;
  /** Highest seq handed to the consumer — the dedup cursor. */
  let maxSeqSeen = 0;
  let status: ChatSocketStatus = {
    state: "connecting",
    refusal: undefined,
    attempt: 0,
  };

  function setStatus(
    state: ChatConnectionState,
    refusal?: ChatSocketRefusal
  ): void {
    status = { state, refusal, attempt };
    options.onStatus(status);
  }

  function send(frame: unknown): void {
    if (!connection) return;
    try {
      connection.send(JSON.stringify(frame));
    } catch {
      // A send on a socket that just died is not an error worth surfacing:
      // the close handler is already on its way and will reconnect.
    }
  }

  function backoffDelay(): number {
    const exponential = baseDelay * 2 ** Math.max(0, attempt - 1);
    const capped = Math.min(exponential, maxDelay);
    // Full jitter — a fleet of tabs reconnecting after one server blip must
    // not arrive as one wave.
    return Math.round(capped * (0.5 + random() * 0.5));
  }

  function connect(): void {
    if (disposed) return;
    setStatus("connecting");
    // The consumer may have advanced by REST while we were down; never hand
    // it a frame it already has.
    maxSeqSeen = Math.max(maxSeqSeen, options.lastSeq());
    connection = factory(options.url, {
      onOpen: () => {
        if (disposed) return;
        attempt = 0;
        send({ type: "hello", last_seq: options.lastSeq() });
        setStatus("open");
      },
      onData: (data) => {
        if (disposed) return;
        const frame = decodeServerFrame(data);
        // An unreadable frame must NOT advance the cursor — the gap it would
        // hide is exactly what resume-by-seq exists to close.
        if (!frame) return;
        if (frame.type === "message") {
          if (frame.seq <= maxSeqSeen) return;
          maxSeqSeen = frame.seq;
        }
        options.onFrame(frame);
      },
      onError: () => {
        // `error` always precedes `close` on a browser socket; the close
        // handler owns the reconnect so the two cannot both schedule one.
      },
      onClose: (code) => {
        if (disposed) return;
        connection = null;
        const refusal = refusalFor(code);
        if (refusal) {
          // The host answered the question. Asking again, faster, is the
          // classic way to turn a 4403 into an outage.
          setStatus("closed", refusal);
          return;
        }
        attempt += 1;
        if (attempt >= maxAttempts) {
          setStatus("closed", "unreachable");
          return;
        }
        setStatus("degraded");
        cancelRetry = schedule(connect, backoffDelay());
      },
    });
  }

  connect();

  return {
    status: () => status,
    ack: (seq) => {
      send({ type: "ack", seq });
    },
    ping: () => {
      send({ type: "ping" });
    },
    close: () => {
      disposed = true;
      cancelRetry?.();
      cancelRetry = null;
      const open = connection;
      connection = null;
      open?.close();
      status = { state: "closed", refusal: undefined, attempt };
    },
  };
}
