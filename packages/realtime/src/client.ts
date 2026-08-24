/**
 * The realtime runtime: one object that owns every socket a host has open,
 * routes wire-v1 frames to the streams that asked for them, and turns close
 * codes into the three answers a client is allowed to give.
 *
 * ## What it does, and why each part is not optional
 *
 * - **Resume, never subscribe-and-hope.** Every (re)connect opens with
 *   `hello{last_seq}` carrying the highest ENVELOPE seq that stream holds, read
 *   fresh at connect time (the consumer keeps advancing over REST while the
 *   socket is down — that is the whole point of resuming by cursor). A
 *   reconnect after five seconds and after five minutes are the same operation.
 * - **Idempotent by envelope seq.** The server drops journal frames it has
 *   already sent; this client drops journal frames it has already surfaced. The
 *   replay/live overlap after a resume is invisible on both ends.
 * - **Ephemeral frames can never enter a journal.** A signal carries no `seq`
 *   structurally; if a buggy module ever attaches one, it is ignored rather
 *   than allowed to move a resume cursor.
 * - **The heartbeat is answered.** A server `ping` gets a `pong` on the same
 *   socket, immediately. Not answering is what makes the server close 4408
 *   every 35 seconds — which looks, from the outside, exactly like a working
 *   socket with a reconnect twitch, and costs a full replay each time.
 * - **A gap is not a stall.** Past the replay window the server sends `resync`
 *   (a frame, not an error — the socket stays open). This client says so and
 *   stops pretending to be current; re-hydrating over REST is the consumer's
 *   job, because the consumer is what owns the history.
 * - **A refusal is not a retry, and 4401 is not a refusal.** See
 *   {@link closeDisposition}. 4404/4410 end that stream. 4401 on a
 *   cookie-authenticated browser means the SESSION is stale: refresh it
 *   through core's `SessionManager` seam, reconnect exactly once, and only then
 *   surface a refusal a person can see.
 * - **4403 is two different failures wearing one number.** Core's origin gate
 *   refuses the handshake before it is accepted (an operator's
 *   `STAPEL_WS_ALLOWED_ORIGINS` problem, identical for every user);
 *   `authorize()` refuses one stream on a socket that was accepted. They are
 *   reported as different refusal kinds and treated differently — see
 *   {@link RealtimeRefusal}.
 * - **The socket never rotates a token.** When core's cookie branch re-mints an
 *   access token during the handshake it puts it in
 *   `scope["stapel_refreshed_access_token"]`, and `stapel-realtime` does not
 *   forward it in any frame (checked, 0.4.x). So the fresh cookie arrives on
 *   the next ordinary HTTP call, which is exactly what the pair's REST traffic
 *   already does; nothing here needs to read a token, and nothing here does.
 * - **No silent give-up.** There is no attempt budget. `reconnecting` is a
 *   state the skin must render; a client that quietly stops and lets the pair
 *   fall back to polling is indistinguishable from a working one, and that is
 *   the defect this package exists to end.
 *
 * ## Topology
 *
 * Streams are grouped by the URL they resolve to, and every group is ONE
 * socket: frames are routed by `envelope.stream`, and `hello` is sent per
 * stream. Against the shipped v1 server (socket per stream) each stream
 * resolves to its own path and each socket carries one — the same code path,
 * with the group size at one. Nothing above this file changes when the server
 * grows a multiplexing consumer.
 */
import { backoffDelay, defaultSchedule } from "./backoff.js";
import type { BackoffOptions, Cancel, Schedule } from "./backoff.js";
import {
  CLOSE_FORBIDDEN,
  CLOSE_REVOKED,
  CLOSE_STREAM_UNKNOWN,
  closeDisposition,
} from "./closeCodes.js";
import {
  ERROR_UNAUTHORIZED,
  FRAME_ERROR,
  FRAME_KICK,
  FRAME_PING,
  FRAME_PONG,
  FRAME_REPLAY,
  FRAME_REPLAY_DONE,
  FRAME_RESYNC,
  FRAME_WELCOME,
  decodeFrame,
  encodeFrame,
  helloFrame,
  pongFrame,
} from "./frames.js";
import type { RealtimeFrame } from "./frames.js";
import { browserSocketFactory, canOpenWebSocket } from "./transport.js";
import type { RealtimeSocket, RealtimeSocketFactory } from "./transport.js";

/** Server heartbeat interval (`STAPEL_REALTIME.HEARTBEAT_S`, seconds → ms). */
export const DEFAULT_HEARTBEAT_MS = 25_000;
/** Grace the server allows for our `pong` (`HEARTBEAT_TIMEOUT_S`). */
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 10_000;

/** Aggregate connection state, as a shell indicator reads it. */
export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "refused"
  | "closed";

/**
 * Why a stream (or the whole client) will not come back on its own — the KIND
 * of refusal, which is not the same thing as the close code, because 4403
 * carries two entirely different failures.
 *
 * | kind | close | what it actually is | who fixes it |
 * |---|---|---|---|
 * | `session` | 4401, after a refresh and one reconnect | the credential is dead | the person signs in again |
 * | `origin` | 4403 **before the handshake was accepted** | `STAPEL_WS_ALLOWED_ORIGINS` is empty or does not list this page's origin (core's gate runs before the token is even read) | an operator, in deployment config |
 * | `forbidden` | 4403 on an ACCEPTED socket | `authorize()` said no for this stream | the owner grants access |
 * | `stream_unknown` | 4404 | the URL names no servable stream | a developer |
 * | `revoked` | 4410 / a `kick` frame | rights withdrawn mid-socket | the owner |
 * | `unsupported` | — | this environment has no `WebSocket` (SSR, node) | nothing to fix |
 *
 * `origin` is deliberately NOT `forbidden`: it is a whole-deployment
 * misconfiguration, identical for every user and every stream, and reading it
 * as "you are not allowed in here" sends an operator hunting for a permissions
 * bug that does not exist. It is also not a credential problem, so it never
 * spends a session refresh.
 */
export type RealtimeRefusal =
  | "session"
  | "origin"
  | "forbidden"
  | "stream_unknown"
  | "revoked"
  | "unsupported";

/** Per-stream state. `resync` is a state, not an error — see the file header. */
export type RealtimeStreamState =
  | "idle"
  | "connecting"
  | "replaying"
  | "live"
  | "reconnecting"
  | "resync"
  | "refused"
  | "closed";

export interface RealtimeStreamStatus {
  readonly stream: string;
  readonly state: RealtimeStreamState;
  /** Set only in `refused`. */
  readonly refusal: RealtimeRefusal | undefined;
  /** The server's own words when it gave any (a `kick` reason, a close reason). */
  readonly reason: string | undefined;
  /** Consecutive failed connects on this stream's socket since the last `welcome`. */
  readonly attempt: number;
  /**
   * The resume cursor (`envelope.seq`) held at the moment this status was
   * published. For the live value read {@link RealtimeSubscription.cursor}.
   */
  readonly cursor: number;
  /** How far behind the replay window we fell. Set only in `resync`. */
  readonly gap: number | undefined;
  /** The server's tip, from `welcome`/`resync`. */
  readonly serverSeq: number | undefined;
}

export interface RealtimeState {
  readonly state: RealtimeConnectionState;
  readonly connected: boolean;
  readonly reconnecting: boolean;
  readonly refused: boolean;
  readonly refusal: RealtimeRefusal | undefined;
  readonly reason: string | undefined;
  readonly attempt: number;
  /**
   * Resume cursor per stream — the exact numbers a reconnect will send back as
   * `hello{last_seq}`. Sampled whenever a connection or stream state changes
   * (which is when anyone looks at them); a per-frame live read is
   * {@link RealtimeClient.cursors}.
   */
  readonly cursors: Readonly<Record<string, number>>;
}

/**
 * The session seam. `SessionManager` from `@stapel/core` satisfies it
 * structurally — this package takes the shape, not the class, so a host with
 * its own session object is not forced to construct one of core's.
 *
 * Only `refresh()` is required, and it must be the single-flight one: N
 * sockets that all see 4401 in the same second must produce ONE refresh call,
 * which is precisely what core's manager already guarantees.
 */
export interface RealtimeSessionSeam {
  refresh(): Promise<boolean>;
  /** Declare the session dead after a refresh did not save it. */
  sessionLost?(reason?: "expired" | "revoked" | "unknown"): unknown;
  /**
   * Core's event seam. Used for ONE event, `session:refresh-unavailable`:
   * a refresh that never reached a verdict (a 502 mid-deploy) must not be read
   * as "your session is gone" — the socket backs off and retries instead.
   */
  on?(event: string, handler: (payload: unknown) => void): () => void;
}

/**
 * Where a stream's socket lives. A plain string puts every stream on ONE
 * socket (multiplexed, routed by `envelope.stream`); a function gives each
 * stream its own URL, which is the shipped v1 server's socket-per-stream
 * topology (`ws/chat/<uuid>`, and chat's REST rows hand you `socket_path`).
 */
export type RealtimeUrl = string | ((stream: string) => string);

export interface RealtimeClientOptions {
  readonly url: RealtimeUrl;
  /**
   * `Sec-WebSocket-Protocol` values for NON-browser hosts (see
   * {@link bearerSubprotocols}). A browser page authenticates with its
   * httpOnly cookie and passes nothing here.
   */
  readonly protocols?: readonly string[] | ((stream: string) => readonly string[] | undefined);
  /** Session seam for the 4401 path. Pass core's `SessionManager`. */
  readonly session?: RealtimeSessionSeam | null;
  readonly reconnect?: BackoffOptions;
  readonly heartbeat?: {
    readonly intervalMs?: number;
    readonly timeoutMs?: number;
  };
  /** Injectable transport (tests, instrumentation, React Native). */
  readonly webSocket?: RealtimeSocketFactory;
  /** Injectable timer (tests drive it by hand). */
  readonly schedule?: Schedule;
  /** Injectable jitter source (tests pin the draw). */
  readonly random?: () => number;
  readonly onState?: (state: RealtimeState) => void;
}

export interface RealtimeSubscribeOptions {
  /** Override the client's URL resolution for this stream. */
  readonly url?: string;
  /**
   * The highest ENVELOPE seq the consumer holds, read afresh at every connect
   * — a function, not a value, because the consumer keeps advancing by REST
   * while the socket is down. Never pass a `payload.seq` here.
   */
  readonly lastSeq?: () => number;
  readonly onFrame?: (frame: RealtimeFrame) => void;
  readonly onState?: (status: RealtimeStreamStatus) => void;
}

export interface RealtimeSubscription {
  readonly stream: string;
  status(): RealtimeStreamStatus;
  /** Live resume cursor (`envelope.seq`), unsampled. */
  cursor(): number;
  /**
   * Send a client frame on this stream. The substrate's own rule is that
   * writes go over REST — this seam exists for the documented legacy
   * exception (chat's `send`/`edit`/`delete`/`read`/`delivered`/`activity`),
   * so a pair does not hand-roll an envelope beside this one. Returns `false`
   * when there is no open socket to write to.
   */
  send(type: string, payload?: Readonly<Record<string, unknown>>): boolean;
  /** Drop this subscription. Closes the socket when it was the last on it. */
  close(): void;
}

export interface RealtimeClient {
  subscribe(stream: string, options?: RealtimeSubscribeOptions): RealtimeSubscription;
  getState(): RealtimeState;
  streamStatus(stream: string): RealtimeStreamStatus | undefined;
  /** Live resume cursors, per stream. */
  cursors(): Readonly<Record<string, number>>;
  /** Re-render seam: fires on connection and stream state transitions. */
  onState(listener: (state: RealtimeState) => void): () => void;
  /**
   * Try again now: clears refusals, re-arms the one-shot session refresh and
   * reconnects every socket. The "Reconnect" button beside a visible refusal.
   */
  reconnect(): void;
  /**
   * Tear every socket and subscription down. Idempotent, and NOT a tombstone:
   * a later {@link RealtimeClient.subscribe} revives the client, which is what
   * makes React's StrictMode double-effect harmless.
   */
  close(): void;
}

interface StreamRecord {
  readonly stream: string;
  connKey: string;
  cursor: number;
  status: RealtimeStreamStatus;
  readonly subscribers: Set<Subscriber>;
}

interface Subscriber {
  readonly onFrame: ((frame: RealtimeFrame) => void) | undefined;
  readonly onState: ((status: RealtimeStreamStatus) => void) | undefined;
  readonly lastSeq: (() => number) | undefined;
}

interface Connection {
  readonly key: string;
  readonly url: string;
  readonly protocols: readonly string[] | undefined;
  socket: RealtimeSocket | null;
  /**
   * Bumped on every connect. Handlers capture their generation and ignore
   * anything from an older one — a socket that closes AFTER its replacement
   * opened must not schedule a second reconnect (identity comparison against
   * `socket` cannot do this: the handlers are built before the object exists).
   */
  generation: number;
  attempt: number;
  cancelRetry: Cancel | null;
  cancelLiveness: Cancel | null;
  /** One session refresh may still be spent on a 4401 from this socket. */
  refreshArmed: boolean;
  opened: boolean;
  /** This socket has been open at least once, so a retry is a RECONNECT. */
  everOpened: boolean;
  /**
   * An `error{code=unauthorized}` frame arrived on this (accepted) socket. It
   * is the substrate's re-authorize denial and the 4403 that follows it is a
   * per-stream `authorize()` verdict, never the origin gate.
   */
  sawUnauthorized: boolean;
  /** The single delayed retry an `origin` refusal is allowed has been spent. */
  originRetried: boolean;
  readonly streams: Set<string>;
}

/**
 * Which refusal a terminal close means.
 *
 * The 4403 split is derived, not guessed. Core's origin gate and the
 * substrate's `authorize()` both close 4403 and neither sends a reason string
 * — but the gate runs in ASGI middleware BEFORE `websocket.accept`, so the
 * socket never opens, while a `hello` that fails re-authorization is refused
 * on a socket that already opened (and is preceded by
 * `error{code=unauthorized}`). "Did this socket ever open" is therefore the
 * one honest signal available, and it is the one used.
 *
 * The residue is a first-connect `authorize()` denial, which also closes
 * pre-accept and is reported as `origin`. That is stated rather than hidden:
 * see the `origin` row in {@link RealtimeRefusal}, and note that a pair only
 * subscribes to streams its REST layer already listed, which is what makes the
 * misconfiguration the far likelier of the two.
 */
function refusalForClose(code: number, connection: Connection): RealtimeRefusal {
  if (code === CLOSE_STREAM_UNKNOWN) return "stream_unknown";
  if (code === CLOSE_REVOKED) return "revoked";
  if (code === CLOSE_FORBIDDEN) {
    return connection.everOpened || connection.sawUnauthorized ? "forbidden" : "origin";
  }
  return "session";
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Build a realtime client. Nothing connects until the first
 * {@link RealtimeClient.subscribe} — a host can construct this at module scope
 * without opening a socket for a page that never watches anything.
 */
export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const factory = options.webSocket ?? browserSocketFactory;
  const usingBrowserTransport = options.webSocket === undefined;
  const schedule = options.schedule ?? defaultSchedule;
  const random = options.random ?? Math.random;
  const heartbeatMs = options.heartbeat?.intervalMs ?? DEFAULT_HEARTBEAT_MS;
  const heartbeatTimeoutMs = options.heartbeat?.timeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
  const session = options.session ?? null;

  const streams = new Map<string, StreamRecord>();
  const connections = new Map<string, Connection>();
  const stateListeners = new Set<(state: RealtimeState) => void>();
  let disposed = false;
  let snapshot: RealtimeState = {
    state: "idle",
    connected: false,
    reconnecting: false,
    refused: false,
    refusal: undefined,
    reason: undefined,
    attempt: 0,
    cursors: {},
  };
  if (options.onState) stateListeners.add(options.onState);

  function resolveUrl(stream: string, override: string | undefined): string {
    if (override !== undefined) return override;
    return typeof options.url === "string" ? options.url : options.url(stream);
  }

  function resolveProtocols(stream: string): readonly string[] | undefined {
    const p = options.protocols;
    if (p === undefined) return undefined;
    return typeof p === "function" ? p(stream) : p;
  }

  function liveCursors(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const record of streams.values()) out[record.stream] = record.cursor;
    return out;
  }

  function publish(): void {
    let connected = false;
    let connecting = false;
    let reconnecting = false;
    let attempt = 0;
    for (const connection of connections.values()) {
      if (connection.socket !== null && connection.opened) connected = true;
      else if (connection.socket !== null) connecting = true;
      else if (connection.cancelRetry !== null) reconnecting = true;
      attempt = Math.max(attempt, connection.attempt);
    }
    let refusal: RealtimeRefusal | undefined;
    let reason: string | undefined;
    for (const record of streams.values()) {
      if (record.status.state === "refused" && refusal === undefined) {
        refusal = record.status.refusal;
        reason = record.status.reason;
      }
    }
    let state: RealtimeConnectionState;
    if (disposed) state = "closed";
    else if (connected) state = "open";
    else if (reconnecting) state = "reconnecting";
    else if (connecting) state = "connecting";
    else if (refusal !== undefined) state = "refused";
    else state = "idle";

    snapshot = {
      state,
      connected,
      reconnecting,
      refused: state === "refused",
      refusal: state === "refused" ? refusal : undefined,
      reason: state === "refused" ? reason : undefined,
      attempt,
      cursors: liveCursors(),
    };
    for (const listener of stateListeners) listener(snapshot);
  }

  function setStreamStatus(
    record: StreamRecord,
    patch: Partial<Omit<RealtimeStreamStatus, "stream">>
  ): void {
    const next: RealtimeStreamStatus = {
      stream: record.stream,
      state: patch.state ?? record.status.state,
      refusal: "refusal" in patch ? patch.refusal : record.status.refusal,
      reason: "reason" in patch ? patch.reason : record.status.reason,
      attempt: patch.attempt ?? record.status.attempt,
      cursor: record.cursor,
      gap: "gap" in patch ? patch.gap : record.status.gap,
      serverSeq: "serverSeq" in patch ? patch.serverSeq : record.status.serverSeq,
    };
    record.status = next;
    for (const subscriber of record.subscribers) subscriber.onState?.(next);
  }

  function streamsOf(connection: Connection): StreamRecord[] {
    const out: StreamRecord[] = [];
    for (const key of connection.streams) {
      const record = streams.get(key);
      if (record) out.push(record);
    }
    return out;
  }

  function resumeCursor(record: StreamRecord): number {
    let cursor = record.cursor;
    for (const subscriber of record.subscribers) {
      // The consumer may have advanced by REST while we were down; never ask
      // for frames it already holds.
      if (subscriber.lastSeq) cursor = Math.max(cursor, subscriber.lastSeq());
    }
    record.cursor = cursor;
    return cursor;
  }

  function clearTimers(connection: Connection): void {
    connection.cancelRetry?.();
    connection.cancelRetry = null;
    connection.cancelLiveness?.();
    connection.cancelLiveness = null;
  }

  function armLiveness(connection: Connection): void {
    connection.cancelLiveness?.();
    // The server pings every HEARTBEAT_S and closes 4408 if our pong is late.
    // Silence for longer than its whole window means the socket died in a way
    // that produced no close event (a sleeping laptop, a dead NAT binding).
    connection.cancelLiveness = schedule(() => {
      if (disposed) return;
      const socket = connection.socket;
      // Retire this generation FIRST: the close event we are about to cause
      // must not schedule a second reconnect on top of ours.
      connection.generation += 1;
      connection.socket = null;
      connection.opened = false;
      socket?.close();
      scheduleReconnect(connection, undefined);
    }, heartbeatMs + heartbeatTimeoutMs);
  }

  function refuse(
    connection: Connection,
    refusal: RealtimeRefusal,
    reason: string | undefined
  ): void {
    clearTimers(connection);
    connection.socket = null;
    connection.opened = false;
    for (const record of streamsOf(connection)) {
      // A stream refused by a `kick` frame already holds the server's own
      // words. The close code that follows carries none, and overwriting the
      // reason with nothing turns "removed from the conversation" back into
      // "disconnected".
      if (record.status.state === "refused") continue;
      setStreamStatus(record, { state: "refused", refusal, reason });
    }
    publish();
  }

  function scheduleReconnect(connection: Connection, reason: string | undefined): void {
    if (disposed) return;
    connection.attempt += 1;
    for (const record of streamsOf(connection)) {
      if (record.status.state === "refused") continue;
      setStreamStatus(record, {
        state: "reconnecting",
        attempt: connection.attempt,
        reason,
      });
    }
    connection.cancelRetry = schedule(
      () => {
        connection.cancelRetry = null;
        connect(connection);
      },
      backoffDelay(connection.attempt, options.reconnect, random)
    );
    publish();
  }

  function handleUnauthenticated(connection: Connection): void {
    clearTimers(connection);
    connection.socket = null;
    connection.opened = false;

    if (session === null) {
      // Nothing to refresh: say so out loud rather than retry a question the
      // server already answered.
      refuse(connection, "session", undefined);
      return;
    }
    if (!connection.refreshArmed) {
      // We already spent a refresh and the server said 4401 again without an
      // intervening `welcome`. That is the HTTP path's verdict: the session is
      // dead, and something above us has to send the person to sign in.
      session.sessionLost?.("expired");
      refuse(connection, "session", undefined);
      return;
    }
    connection.refreshArmed = false;
    for (const record of streamsOf(connection)) {
      if (record.status.state === "refused") continue;
      setStreamStatus(record, { state: "reconnecting" });
    }
    publish();

    // A refresh that never reached a verdict (a 502 mid-deploy) is not
    // evidence the credential is dead — core says so on this event, and the
    // socket must back off, not throw the user out.
    let unavailable = false;
    const off = session.on?.("session:refresh-unavailable", () => {
      unavailable = true;
    });
    void session
      .refresh()
      .then((ok) => {
        off?.();
        if (disposed || connections.get(connection.key) !== connection) return;
        if (ok) {
          // One immediate retry with the fresh credential — no backoff, the
          // person is looking at the screen.
          connect(connection);
          return;
        }
        if (unavailable) {
          connection.refreshArmed = true;
          scheduleReconnect(connection, undefined);
          return;
        }
        refuse(connection, "session", undefined);
      })
      .catch(() => {
        off?.();
        if (disposed || connections.get(connection.key) !== connection) return;
        connection.refreshArmed = true;
        scheduleReconnect(connection, undefined);
      });
  }

  function deliver(connection: Connection, frame: RealtimeFrame): void {
    // Any frame is proof of life.
    armLiveness(connection);

    if (frame.type === FRAME_PING) {
      // THE reason 4408 stops firing. Answer on the same socket, now.
      connection.socket?.send(pongFrame(frame.stream));
      return;
    }
    if (frame.type === FRAME_PONG) return;

    const key =
      frame.stream ??
      (connection.streams.size === 1 ? [...connection.streams][0] : undefined);
    if (key === undefined) return;
    const record = streams.get(key);
    if (record === undefined || !connection.streams.has(key)) return;

    if (frame.envelopeSeq !== undefined) {
      if (frame.signal) {
        // A signal cannot have been persisted, so a `seq` on one is a module
        // bug. Deliver it, but never let it move a resume cursor.
        for (const subscriber of record.subscribers) subscriber.onFrame?.(frame);
        return;
      }
      if (frame.envelopeSeq <= record.cursor) return; // replay/live overlap
      record.cursor = frame.envelopeSeq;
    }

    switch (frame.type) {
      case FRAME_WELCOME: {
        // Reset the backoff HERE, not on the socket's open event: a handshake
        // that is accepted and then refused mid-protocol has proven nothing.
        connection.attempt = 0;
        connection.refreshArmed = true;
        const ephemeral = frame.payload["ephemeral"] === true;
        setStreamStatus(record, {
          state: ephemeral ? "live" : "replaying",
          attempt: 0,
          refusal: undefined,
          reason: undefined,
          gap: undefined,
          serverSeq: readNumber(frame.payload["server_seq"]),
        });
        publish();
        break;
      }
      case FRAME_REPLAY:
        if (record.status.state !== "replaying") {
          setStreamStatus(record, { state: "replaying" });
        }
        break;
      case FRAME_REPLAY_DONE:
        setStreamStatus(record, {
          state: "live",
          serverSeq: readNumber(frame.payload["up_to_seq"]) ?? record.status.serverSeq,
        });
        publish();
        break;
      case FRAME_RESYNC:
        // Not an error: the gap is wider than the server's replay window, so
        // the truth is behind REST now. Say it and stop claiming to be current.
        setStreamStatus(record, {
          state: "resync",
          gap: readNumber(frame.payload["gap"]),
          serverSeq: readNumber(frame.payload["server_seq"]),
        });
        publish();
        break;
      case FRAME_ERROR:
        // `error{code=unauthorized}` is the substrate's re-authorize denial on
        // an ACCEPTED socket, and the 4403 that follows it is a per-stream
        // `authorize()` verdict — not the origin gate, which never lets a
        // socket get this far.
        if (frame.payload["code"] === ERROR_UNAUTHORIZED) {
          connection.sawUnauthorized = true;
        }
        break;
      case FRAME_KICK:
        // The reason arrives BEFORE the close (4410), so read it here — by the
        // time the close code lands the server has said nothing more.
        setStreamStatus(record, {
          state: "refused",
          refusal: "revoked",
          reason: readString(frame.payload["reason"]) ?? "access_revoked",
        });
        publish();
        break;
      default:
        break;
    }

    for (const subscriber of record.subscribers) subscriber.onFrame?.(frame);
  }

  function connect(connection: Connection): void {
    if (disposed) return;
    if (usingBrowserTransport && !canOpenWebSocket()) {
      refuse(connection, "unsupported", undefined);
      return;
    }
    clearTimers(connection);
    for (const record of streamsOf(connection)) {
      if (record.status.state === "refused") continue;
      setStreamStatus(record, {
        // `connecting` means "we have never been up"; anything after that is a
        // RECONNECT, and a person watching the indicator must be told which
        // one it is — the 4401-refresh path reconnects with the attempt
        // counter still at zero, and calling that "connecting" hides that the
        // session just had to be renewed.
        state: connection.everOpened ? "reconnecting" : "connecting",
        attempt: connection.attempt,
      });
    }

    const generation = (connection.generation += 1);
    const isCurrent = (): boolean => !disposed && connection.generation === generation;

    const socket = factory(
      connection.url,
      {
        onOpen: () => {
          if (!isCurrent() || connection.socket === null) return;
          connection.opened = true;
          connection.everOpened = true;
          // `hello` per stream IS the subscribe: the server re-runs
          // `authorize()` on every one of them.
          for (const record of streamsOf(connection)) {
            if (record.status.state === "refused") continue;
            connection.socket.send(helloFrame(record.stream, resumeCursor(record)));
          }
          armLiveness(connection);
          publish();
        },
        onData: (data) => {
          if (!isCurrent()) return;
          const frame = decodeFrame(data);
          // An unreadable frame must NOT advance any cursor — the gap it would
          // hide is exactly what resume-by-seq exists to close.
          if (frame === null) return;
          deliver(connection, frame);
        },
        onError: () => {
          // `error` always precedes `close` on a browser socket; the close
          // handler owns the reconnect so the two cannot both schedule one.
        },
        onClose: (code, reason) => {
          if (!isCurrent()) return;
          connection.socket = null;
          connection.opened = false;
          clearTimers(connection);
          const disposition = closeDisposition(code);
          if (disposition === "terminal") {
            // 4403/4404 are verdicts about a STREAM. On a socket carrying one
            // stream (the shipped v1 topology) that is unambiguous; on a
            // multiplexed socket the code alone cannot name which stream was
            // refused, so every stream on it is refused and says so.
            const refusal = refusalForClose(code, connection);
            if (refusal === "origin" && !connection.originRetried) {
              // A deployment fault, not a verdict about this user: an origin
              // allowlist that is being rolled out can be right a moment
              // later. So ONE delayed retry — and then it holds, because
              // hammering a host over its own configuration helps nobody and
              // the operator needs to SEE the refusal to go and fix it.
              connection.originRetried = true;
              scheduleReconnect(connection, readString(reason));
              return;
            }
            refuse(connection, refusal, readString(reason));
            return;
          }
          if (disposition === "reauthenticate") {
            handleUnauthenticated(connection);
            return;
          }
          scheduleReconnect(connection, readString(reason));
        },
      },
      connection.protocols
    );
    connection.socket = socket;
    publish();
  }

  function connectionFor(stream: string, url: string): Connection {
    const existing = connections.get(url);
    if (existing) return existing;
    const created: Connection = {
      key: url,
      url,
      protocols: resolveProtocols(stream),
      socket: null,
      generation: 0,
      attempt: 0,
      cancelRetry: null,
      cancelLiveness: null,
      refreshArmed: true,
      opened: false,
      everOpened: false,
      sawUnauthorized: false,
      originRetried: false,
      streams: new Set<string>(),
    };
    connections.set(url, created);
    return created;
  }

  function dropConnection(connection: Connection): void {
    clearTimers(connection);
    const socket = connection.socket;
    connection.generation += 1; // retire the handlers before they see the close
    connection.socket = null;
    connection.opened = false;
    connections.delete(connection.key);
    socket?.close();
  }

  function subscribe(
    stream: string,
    subscribeOptions?: RealtimeSubscribeOptions
  ): RealtimeSubscription {
    // `close()` is a teardown, not a tombstone (see it below): subscribing
    // again brings the client back. React's StrictMode runs an effect's
    // cleanup and then the effect again, and a client that could never be
    // revived would leave every dev-mode page permanently silent.
    disposed = false;
    let record = streams.get(stream);
    // A stream key names ONE stream. If it is already riding a socket, a second
    // subscriber joins that socket rather than opening a rival one with its own
    // cursor — two sockets on one key would double-deliver and resume twice.
    const url = record?.connKey ?? resolveUrl(stream, subscribeOptions?.url);
    const connection = connectionFor(stream, url);
    if (record === undefined) {
      record = {
        stream,
        connKey: connection.key,
        cursor: 0,
        status: {
          stream,
          state: "idle",
          refusal: undefined,
          reason: undefined,
          attempt: 0,
          cursor: 0,
          gap: undefined,
          serverSeq: undefined,
        },
        subscribers: new Set<Subscriber>(),
      };
      streams.set(stream, record);
    }
    const target = record;
    connection.streams.add(stream);

    const subscriber: Subscriber = {
      onFrame: subscribeOptions?.onFrame,
      onState: subscribeOptions?.onState,
      lastSeq: subscribeOptions?.lastSeq,
    };
    target.subscribers.add(subscriber);

    if (connection.socket === null && connection.cancelRetry === null) {
      connect(connection);
    } else if (connection.opened && connection.socket !== null) {
      // The socket is already up and this stream is new to it — one `hello`
      // subscribes it without disturbing the streams already riding along.
      connection.socket.send(helloFrame(stream, resumeCursor(target)));
      setStreamStatus(target, { state: "connecting" });
      publish();
    }

    let closed = false;
    return {
      stream,
      status: () => target.status,
      cursor: () => target.cursor,
      send: (type, payload) => {
        if (closed || connection.socket === null || !connection.opened) return false;
        connection.socket.send(encodeFrame(type, payload, stream));
        return true;
      },
      close: () => {
        if (closed) return;
        closed = true;
        target.subscribers.delete(subscriber);
        if (target.subscribers.size > 0) return;
        streams.delete(stream);
        connection.streams.delete(stream);
        // v1 has no `unsubscribe` frame — closing the socket IS the
        // unsubscribe. While other streams still ride it, the server keeps
        // sending this stream's frames and they are dropped on arrival.
        if (connection.streams.size === 0) dropConnection(connection);
        publish();
      },
    };
  }

  return {
    subscribe,
    getState: () => snapshot,
    streamStatus: (stream) => streams.get(stream)?.status,
    cursors: () => liveCursors(),
    onState(listener) {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    reconnect() {
      if (disposed) return;
      for (const record of streams.values()) {
        if (record.status.state === "refused") {
          setStreamStatus(record, {
            state: "connecting",
            refusal: undefined,
            reason: undefined,
          });
        }
      }
      for (const connection of connections.values()) {
        clearTimers(connection);
        connection.attempt = 0;
        connection.refreshArmed = true;
        const socket = connection.socket;
        connection.generation += 1;
        connection.socket = null;
        connection.opened = false;
        socket?.close();
        connect(connection);
      }
      publish();
    },
    close() {
      if (disposed) return;
      disposed = true;
      for (const connection of [...connections.values()]) dropConnection(connection);
      streams.clear();
      publish();
      // Listeners are NOT dropped: a host's status indicator subscribes
      // independently of who called close(), and must see the client come back.
    },
  };
}
