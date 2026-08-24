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
 *  - **a credential is renewable; a right is not.** Every close code is read
 *    in ONE place (`closePolicy.ts`) and answers one of three questions —
 *    reconnect, renew the credential, or stop. The rule this replaced ("4401
 *    and 4403 mean never come back") is what let a browser handshake with no
 *    credential on it look like a product decision to poll.
 *  - **it never goes quiet.** Every terminal state carries a NAMED reason in
 *    the status the UI reads. A socket that stops without saying why is how
 *    "websockets are done" stayed a false claim for months.
 *
 * No React and no `@stapel/core` — the future `@stapel/realtime` substrate is
 * meant to replace this file wholesale, so nothing above it may reach into
 * it. The one DOM fact it does own is the credential channel: a browser
 * cannot put a header on a handshake, so the token has to travel in the URL
 * or the subprotocol list, and only the thing that constructs the socket can
 * put it there (`credential.ts`).
 */
import { decodeServerFrame } from "./frames.js";
import type { ChatServerFrame } from "./frames.js";
import { chatClosePolicy } from "./closePolicy.js";
import type { ChatCloseReason } from "./closePolicy.js";
import { chatSocketTarget } from "./credential.js";
import type {
  ChatCredentialRenewal,
  ChatCredentialSource,
} from "./credential.js";

/**
 * Connection state, named as the realtime spec (§7) names it, so the
 * substrate migration is a rename of nothing.
 *
 *  - `connecting` — a socket is being opened (including a reconnect wait and
 *    a credential renewal),
 *  - `open` — connected; frames are arriving,
 *  - `degraded` — the socket dropped and a reconnect is pending,
 *  - `closed` — it will not come back on its own (deliberate close, a
 *    refusal, or the retry budget spent).
 */
export type ChatConnectionState = "connecting" | "open" | "degraded" | "closed";

/**
 * Why the socket will not come back. `undefined` while it still might.
 *
 * `unauthenticated` is reached ONLY after a renewal was impossible or was
 * itself refused — a bare 4401 is a renewable credential, not a verdict.
 */
export type ChatSocketRefusal =
  | "unauthenticated"
  | "forbidden"
  | "unknown_stream"
  | "revoked"
  | "protocol"
  | "unreachable";

export interface ChatSocketStatus {
  readonly state: ChatConnectionState;
  /** Set only in `closed`, and only when the reason is known. */
  readonly refusal: ChatSocketRefusal | undefined;
  /**
   * The close code's meaning, kept through a `degraded` phase too — so a UI
   * can distinguish "reconnecting after a blip" from "renewing a rejected
   * credential" while both are still in flight. `undefined` before the first
   * close.
   */
  readonly reason: ChatCloseReason | undefined;
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
 * Opens one socket. Injectable so a host can wrap the socket
 * (instrumentation, a proxy, React Native).
 *
 * `protocols` is the `Sec-WebSocket-Protocol` list — NOT decoration. It is
 * one of the two channels a browser has for a credential, so a wrapper that
 * drops it silently un-authenticates every handshake. A factory that cannot
 * carry subprotocols must refuse the socket, not open an anonymous one.
 *
 * Injecting this in a TEST, however, is how the credential channel went
 * untested for a whole release: a fake factory is handed a URL and a list
 * that the real `new WebSocket(...)` never sees. Tests that mean to cover
 * the handshake stand a `WebSocket` double at the ENVIRONMENT edge instead
 * (`test/browserSocket.ts`).
 */
export type ChatWebSocketFactory = (
  url: string,
  handlers: ChatSocketHandlers,
  protocols?: readonly string[]
) => ChatSocketConnection;

/** Reconnect backoff knobs (exponential, jittered, capped). */
export interface ChatReconnectOptions {
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  /**
   * Consecutive faults after which the socket stops trying. Default 6.
   *
   * Stopping is NOT a hand-over to a silent polling loop: the status turns
   * `closed` with refusal `unreachable`, and the seam above renders that as
   * a named degraded mode.
   */
  readonly maxAttempts?: number;
  /**
   * How many times one socket may renew a rejected credential before the
   * refusal is taken at face value. Default 1 — a second 4401 on a
   * freshly-minted credential is an answer, and a renewal loop against an
   * auth service is worse than a stopped socket. Reset by every successful
   * handshake.
   */
  readonly maxCredentialRenewals?: number;
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
  /**
   * What credential this build puts on the handshake, read afresh at every
   * connect. Omitted means the cookie channel: `new WebSocket(url)`, and the
   * browser attaches its httpOnly JWT cookie by itself.
   */
  readonly credential?: ChatCredentialSource;
  /** Renew a rejected credential (core's session refresh). See 4401 above. */
  readonly renewCredential?: ChatCredentialRenewal;
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
const DEFAULT_MAX_CREDENTIAL_RENEWALS = 1;

function defaultSchedule(fn: () => void, ms: number): ChatCancel {
  const handle = setTimeout(fn, ms);
  return () => {
    clearTimeout(handle);
  };
}

/**
 * The browser transport, and the ONLY place `new WebSocket` is called.
 *
 * `protocols` is passed straight through to the constructor because that is
 * one of the two doors a credential can come through — the other being the
 * URL. Uses `addEventListener` rather than the `on*` properties so the
 * structural contract above stays independent of the DOM `WebSocket` type
 * (and so a host wrapper can be a plain object).
 */
export function browserWebSocketFactory(
  url: string,
  handlers: ChatSocketHandlers,
  protocols?: readonly string[]
): ChatSocketConnection {
  // `undefined` rather than `[]` for the cookie channel: WebIDL defaults the
  // argument to an empty sequence, so the two are the same handshake, and one
  // construction site keeps this the single place a socket is opened.
  const socket = new WebSocket(
    url,
    protocols && protocols.length > 0 ? [...protocols] : undefined
  );
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

/** The refusal a close reason becomes once it is final. */
function refusalFor(reason: ChatCloseReason): ChatSocketRefusal {
  switch (reason) {
    case "credential_rejected":
      return "unauthenticated";
    case "forbidden":
      return "forbidden";
    case "unknown_stream":
      return "unknown_stream";
    case "revoked":
      return "revoked";
    case "protocol":
      return "protocol";
    default:
      return "unreachable";
  }
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
  const maxRenewals =
    options.reconnect?.maxCredentialRenewals ?? DEFAULT_MAX_CREDENTIAL_RENEWALS;

  let connection: ChatSocketConnection | null = null;
  let cancelRetry: ChatCancel | null = null;
  let disposed = false;
  let attempt = 0;
  let renewals = 0;
  /** Highest seq handed to the consumer — the dedup cursor. */
  let maxSeqSeen = 0;
  let status: ChatSocketStatus = {
    state: "connecting",
    refusal: undefined,
    reason: undefined,
    attempt: 0,
  };

  function setStatus(
    state: ChatConnectionState,
    refusal?: ChatSocketRefusal,
    reason?: ChatCloseReason
  ): void {
    status = { state, refusal, reason, attempt };
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

  /** A fault: back off and try again, or give up SAYING it gave up. */
  function retryLater(reason: ChatCloseReason): void {
    attempt += 1;
    if (attempt >= maxAttempts) {
      setStatus("closed", "unreachable", reason);
      return;
    }
    setStatus("degraded", undefined, reason);
    cancelRetry = schedule(connect, backoffDelay());
  }

  /**
   * 4401. The credential, not the socket, was refused — so ask the host for
   * a better one before concluding anything. Without a renewal seam this is
   * a verdict immediately, and it is SURFACED (`unauthenticated`), never
   * downgraded into a quiet polling loop.
   */
  function renewThenReconnect(reason: ChatCloseReason): void {
    const renew = options.renewCredential;
    if (renew === undefined || renewals >= maxRenewals) {
      setStatus("closed", "unauthenticated", reason);
      return;
    }
    renewals += 1;
    setStatus("connecting", undefined, reason);
    void (async () => {
      let outcome: "renewed" | "refused" | "unavailable";
      try {
        outcome = await renew();
      } catch {
        // A throwing renewal is not evidence the credential is dead — core
        // learned this the day a 502 mid-redeploy signed everyone out.
        outcome = "unavailable";
      }
      if (disposed) return;
      if (outcome === "renewed") {
        connect();
        return;
      }
      if (outcome === "unavailable") {
        // No verdict was obtained. Treat it as the fault it is.
        retryLater(reason);
        return;
      }
      setStatus("closed", "unauthenticated", reason);
    })();
  }

  function connect(): void {
    if (disposed) return;
    setStatus("connecting", undefined, status.reason);
    // The consumer may have advanced by REST while we were down; never hand
    // it a frame it already has.
    maxSeqSeen = Math.max(maxSeqSeen, options.lastSeq());
    // Read the credential HERE, not once at construction: a reconnect an hour
    // later must not replay the token the first handshake used.
    const target = chatSocketTarget(
      options.url,
      options.credential ? options.credential() : null
    );
    connection = factory(
      target.url,
      {
        onOpen: () => {
          if (disposed) return;
          attempt = 0;
          renewals = 0;
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
          const policy = chatClosePolicy(code);
          if (policy.action === "stop") {
            // The host answered a question about RIGHTS, or about this
            // build. Asking again, faster, is the classic way to turn a
            // 4403 into an outage.
            setStatus("closed", refusalFor(policy.reason), policy.reason);
            return;
          }
          if (policy.action === "renew-credential") {
            renewThenReconnect(policy.reason);
            return;
          }
          retryLater(policy.reason);
        },
      },
      target.protocols
    );
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
      status = {
        state: "closed",
        refusal: undefined,
        reason: status.reason,
        attempt,
      };
    },
  };
}
