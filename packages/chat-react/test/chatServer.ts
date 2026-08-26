/**
 * A CHAT SERVER THAT SPEAKS THE REAL WIRE, standing at the ENVIRONMENT EDGE.
 *
 * ── Why the environment edge, and not the injectable factory ────────────────
 *
 * This package once had eighteen green socket tests and a chat that had never
 * authenticated a socket in production. Every one of those tests injected a
 * transport factory that stood EXACTLY where `new WebSocket(...)` stands, so
 * 100% of them bypassed the single line that decides whether a credential
 * reaches the server:
 *
 *     new WebSocket(url)            ← the cookie channel. What a browser does.
 *     new WebSocket(url, protocols) ← the only header-free alternative.
 *
 * A browser cannot set an `Authorization` header on a WebSocket — there is no
 * options bag and no interceptor — so a suite that replaces the constructor
 * can never see the difference. This double therefore replaces
 * `globalThis.WebSocket` and records what the CONSTRUCTOR was called with,
 * while `@stapel/realtime`'s own `browserSocketFactory` runs for real.
 *
 * ── Why a server and not a frame emitter ────────────────────────────────────
 *
 * The second half of the same defect: the pair's decoder was correct about a
 * protocol stapel-chat had deleted, and every test fed it frames from that
 * protocol, so every test passed. A fixture that emits whatever the client
 * expects proves the client agrees with itself.
 *
 * So {@link ChatServer} reproduces the SERVER, from its own sources at the
 * pinned 0.6.0 contract:
 *
 *  - `stapel_realtime/consumers.py::ResumableStreamConsumer.on_hello` — the
 *    welcome, the bounded replay, the `resync` verdict past `MAX_REPLAY`, the
 *    `seq` dedup between replay and live;
 *  - `EphemeralStreamConsumer.on_hello` — `welcome{ephemeral: true}`, no
 *    journal, nothing to resume;
 *  - `_heartbeat_loop` — a `ping` every `HEARTBEAT_S`, and a 4408 close when
 *    no `pong` came back inside `HEARTBEAT_TIMEOUT_S`;
 *  - `stapel_chat/realtime.py::message_payload` — the one message shape, and
 *    the `rev_seq` that rides in the ENVELOPE while `seq` stays in the body;
 *  - `stapel_chat/consumers.py` — the six write frames, answered through the
 *    same `error{code,message}` envelope the module uses.
 *
 * It refuses to answer anything else. A `hello` it cannot parse is an
 * `error{bad_envelope}`, a client frame it does not own is `error{bad_type}`,
 * and a `pong` that never arrives closes the socket — because a fake that is
 * more forgiving than the server is a fake that hides the bug.
 */

// ── the wire, verbatim ──────────────────────────────────────────────────────

/** `stapel_realtime.envelope.WIRE_VERSION`. */
export const WIRE_VERSION = 1;
/** `STAPEL_REALTIME["MAX_REPLAY"]`. */
export const MAX_REPLAY = 500;

export interface Envelope {
  readonly v: number;
  readonly type: string;
  readonly stream?: string;
  readonly payload?: Record<string, unknown>;
  readonly seq?: number;
}

/** `stapel_chat.realtime.message_payload`, field for field. */
export function chatMessagePayload(options: {
  readonly seq: number;
  readonly revSeq?: number;
  readonly conversationId: string;
  readonly messageId?: string;
  readonly senderId?: string | null;
  readonly body?: string;
  readonly clientMsgId?: string | null;
  readonly edited?: boolean;
  readonly deleted?: boolean;
  readonly attachments?: readonly unknown[];
}): Record<string, unknown> {
  const deleted = options.deleted ?? false;
  const edited = options.edited ?? false;
  return {
    message_id: options.messageId ?? `m-${options.seq}`,
    conversation_id: options.conversationId,
    sender_id: options.senderId === undefined ? "u-seller" : options.senderId,
    seq: options.seq,
    rev_seq: options.revSeq ?? options.seq,
    kind: "text",
    body: deleted ? "" : (options.body ?? `message ${options.seq}`),
    reply_to: null,
    attachments: deleted ? [] : [...(options.attachments ?? [])],
    client_msg_id: options.clientMsgId ?? null,
    edited,
    edited_at: edited ? "2026-08-26T18:30:00+00:00" : null,
    deleted,
    deleted_at: deleted ? "2026-08-26T18:31:00+00:00" : null,
    created_at: "2026-08-26T18:20:00+00:00",
  };
}

// ── the transport double ────────────────────────────────────────────────────

type Listener = (event: unknown) => void;

/** One `new WebSocket(...)` the code under test performed. */
export class ConstructedSocket {
  static readonly opened: ConstructedSocket[] = [];

  /** Payloads the client sent, decoded. */
  readonly sent: Envelope[] = [];
  closedByClient = false;
  opened = false;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(
    readonly url: string,
    readonly protocols?: string | readonly string[]
  ) {
    ConstructedSocket.opened.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  send(payload: string): void {
    this.sent.push(JSON.parse(payload) as Envelope);
  }

  close(): void {
    this.closedByClient = true;
    this.opened = false;
  }

  private fire(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  /** The handshake completed. */
  accept(): void {
    this.opened = true;
    this.fire("open", {});
  }

  /** Server → client: one envelope, JSON-encoded as the consumer sends it. */
  deliver(envelope: Envelope): void {
    this.fire("message", { data: JSON.stringify(envelope) });
  }

  /** Server → client: a raw payload (the malformed-frame cases). */
  deliverRaw(data: unknown): void {
    this.fire("message", { data });
  }

  serverClose(code: number, reason = ""): void {
    this.opened = false;
    this.fire("close", { code, reason });
  }

  received(type: string): Envelope[] {
    return this.sent.filter((frame) => frame.type === type);
  }
}

export interface BrowserWebSocketEnvironment {
  /** Every socket constructed, in order — index 1 is the first reconnect. */
  readonly sockets: readonly ConstructedSocket[];
  readonly last: () => ConstructedSocket;
  /** The most recent socket opened against a URL containing `needle`. */
  readonly lastFor: (needle: string) => ConstructedSocket;
  /** Put the real (jsdom) `WebSocket` back. */
  restore(): void;
}

/**
 * Replace `globalThis.WebSocket` for the duration of a test. The code under
 * test is untouched: `@stapel/realtime`'s `browserSocketFactory` still runs,
 * still decides what to construct, and this only records the call.
 */
export function installBrowserWebSocket(): BrowserWebSocketEnvironment {
  const original = globalThis.WebSocket;
  ConstructedSocket.opened.length = 0;
  globalThis.WebSocket = ConstructedSocket as unknown as typeof WebSocket;
  const find = (needle: string): ConstructedSocket => {
    for (let i = ConstructedSocket.opened.length - 1; i >= 0; i -= 1) {
      const socket = ConstructedSocket.opened[i];
      if (socket !== undefined && socket.url.includes(needle)) return socket;
    }
    throw new Error(`no WebSocket was constructed for ${needle}`);
  };
  return {
    sockets: ConstructedSocket.opened,
    last: () => {
      const socket = ConstructedSocket.opened[ConstructedSocket.opened.length - 1];
      if (socket === undefined) throw new Error("no WebSocket was constructed");
      return socket;
    },
    lastFor: find,
    restore: () => {
      globalThis.WebSocket = original;
      ConstructedSocket.opened.length = 0;
    },
  };
}

// ── the consumer, reproduced ────────────────────────────────────────────────

export interface JournalRow {
  readonly seq: number;
  readonly payload: Record<string, unknown>;
}

export interface ChatServerOptions {
  readonly stream: string;
  /** Ephemeral (`chat:user:<id>`) — no journal, no resume. */
  readonly ephemeral?: boolean;
  readonly maxReplay?: number;
}

/**
 * Drive one {@link ConstructedSocket} the way the consumer drives a real one.
 *
 * Nothing here is automatic: a test calls {@link accept} to complete the
 * handshake and {@link pump} to let the server process what the client has
 * said. That is what keeps "the client answered the heartbeat" an assertion
 * rather than a race.
 */
export class ChatServer {
  readonly journal: JournalRow[] = [];
  /** Envelopes the SERVER sent, in order. */
  readonly outbox: Envelope[] = [];
  /** `_max_seq_sent` — the replay/live dedup cursor. */
  private maxSeqSent = 0;
  private handled = 0;
  private pongPending = false;
  private helloCursor = 0;
  private helloCount = 0;

  constructor(
    readonly socket: ConstructedSocket,
    private readonly options: ChatServerOptions
  ) {}

  /** The `last_seq` the client asked to resume from, on its latest hello. */
  get lastHelloCursor(): number {
    return this.helloCursor;
  }

  get helloFrames(): number {
    return this.helloCount;
  }

  get serverSeq(): number {
    return this.journal.reduce((highest, row) => Math.max(highest, row.seq), 0);
  }

  /** Seed the journal: `count` messages, seq === rev_seq === 1..count. */
  fill(count: number, conversationId: string): void {
    for (let seq = 1; seq <= count; seq += 1) {
      this.journal.push({
        seq,
        payload: chatMessagePayload({ seq, conversationId }),
      });
    }
  }

  /** Complete the handshake, then process the `hello` that follows it. */
  accept(): void {
    this.socket.accept();
    this.pump();
  }

  /** Process every client frame that has arrived since the last call. */
  pump(): void {
    const frames = this.socket.sent;
    for (let index = this.handled; index < frames.length; index += 1) {
      const frame = frames[index];
      if (frame === undefined) continue;
      this.handled = index + 1;
      if (frame.v !== WIRE_VERSION) {
        this.error("bad_envelope", `unsupported envelope version ${String(frame.v)}`);
        continue;
      }
      switch (frame.type) {
        case "hello":
          this.onHello(frame);
          break;
        case "pong":
          this.pongPending = false;
          break;
        case "ping":
          this.send({ v: WIRE_VERSION, type: "pong", stream: this.stream, payload: {} });
          break;
        case "send":
        case "edit":
        case "delete":
        case "read":
        case "delivered":
        case "activity":
          // Chat's write frames are accepted; what they DO is the backend's
          // business and a test asserts on the frame, not on a fake's model.
          break;
        default:
          this.error("bad_type", `unsupported frame type ${frame.type}`);
      }
    }
    this.handled = frames.length;
  }

  private get stream(): string {
    return this.options.stream;
  }

  private onHello(frame: Envelope): void {
    this.helloCount += 1;
    const raw = frame.payload?.["last_seq"];
    if (raw !== undefined && typeof raw !== "number") {
      this.error("bad_envelope", "'last_seq' must be an integer");
      return;
    }
    const lastSeq = Math.max(0, typeof raw === "number" ? raw : 0);
    this.helloCursor = lastSeq;
    if (this.options.ephemeral === true) {
      this.send({
        v: WIRE_VERSION,
        type: "welcome",
        stream: this.stream,
        payload: { ephemeral: true },
      });
      return;
    }
    const serverSeq = this.serverSeq;
    this.send({
      v: WIRE_VERSION,
      type: "welcome",
      stream: this.stream,
      payload: { server_seq: serverSeq },
    });
    this.maxSeqSent = Math.max(this.maxSeqSent, lastSeq);
    const limit = this.options.maxReplay ?? MAX_REPLAY;
    if (serverSeq - lastSeq > limit) {
      this.send({
        v: WIRE_VERSION,
        type: "resync",
        stream: this.stream,
        payload: { gap: serverSeq - lastSeq, window: limit, server_seq: serverSeq },
      });
      return;
    }
    for (const row of this.journal.filter((r) => r.seq > lastSeq).slice(0, limit)) {
      this.sendJournal("replay", row.seq, row.payload);
    }
    this.send({
      v: WIRE_VERSION,
      type: "replay_done",
      stream: this.stream,
      payload: { up_to_seq: serverSeq },
    });
  }

  /**
   * Commit a message and fan it out — `broadcast_message` →
   * `deliver_frame(stream, payload, seq=msg.rev_seq)`.
   */
  publish(payload: Record<string, unknown>): void {
    const revSeq = Number(payload["rev_seq"]);
    this.journal.push({ seq: revSeq, payload });
    this.sendJournal("live", revSeq, payload);
  }

  /** A signal (`chat.read`, `chat.activity`, `chat.inbox`) — never a `seq`. */
  signal(type: string, payload: Record<string, unknown>): void {
    this.send({ v: WIRE_VERSION, type, stream: this.stream, payload });
  }

  /** `kick`, then the 4410 that follows it. */
  revoke(reason = "left_conversation"): void {
    this.signal("kick", { reason });
    this.socket.serverClose(4410);
  }

  private sendJournal(type: string, seq: number, payload: Record<string, unknown>): void {
    if (seq <= this.maxSeqSent) return; // consumers.py::send_frame dedup
    this.maxSeqSent = seq;
    this.send({ v: WIRE_VERSION, type, stream: this.stream, payload, seq });
  }

  private error(code: string, message: string): void {
    this.send({
      v: WIRE_VERSION,
      type: "error",
      stream: this.stream,
      payload: { code, message },
    });
  }

  private send(envelope: Envelope): void {
    this.outbox.push(envelope);
    this.socket.deliver(envelope);
  }

  /**
   * ONE HEARTBEAT TICK — `_heartbeat_loop`, including its teeth.
   *
   * Ping, let the client answer, and close 4408 when it did not. A client
   * that does not answer therefore gets dropped here exactly as it was
   * dropped in production every 35 seconds, which is the only way a test can
   * prove the loop cannot recur.
   *
   * Returns `true` when the socket survived the tick.
   */
  heartbeat(): boolean {
    this.pongPending = true;
    this.send({ v: WIRE_VERSION, type: "ping", stream: this.stream, payload: {} });
    this.pump();
    if (this.pongPending) {
      this.socket.serverClose(4408);
      return false;
    }
    return true;
  }
}
