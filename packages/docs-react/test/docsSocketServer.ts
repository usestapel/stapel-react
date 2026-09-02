/**
 * A DOCS SOCKET SERVER THAT SPEAKS THE REAL WIRE, standing at the
 * ENVIRONMENT EDGE — the `chat-react/test/chatServer.ts` discipline, applied
 * to this pair's one stream.
 *
 * The double replaces `globalThis.WebSocket` and records what the CONSTRUCTOR
 * was called with, while `@stapel/realtime`'s own `browserSocketFactory` runs
 * for real — a factory injected where `new WebSocket(...)` stands can never
 * see the one line that decides whether a credential reaches the server.
 *
 * {@link DocsUpdatesServer} reproduces the SERVER from its own sources at the
 * pinned v0.7.0 contract:
 *
 *  - `stapel_realtime/consumers.py::ResumableStreamConsumer.on_hello` — the
 *    welcome `{server_seq}`, the bounded replay, `replay_done {up_to_seq}`,
 *    the `resync` verdict past the replay window, the seq dedup between
 *    replay and live;
 *  - `stapel_docs/realtime.py::update_payload` — the ONE journal-update wire
 *    shape, identical live and replayed: `{update: <base64>, author_id,
 *    client_id}` with the row's own seq in the ENVELOPE;
 *  - `stapel_docs/consumers.py::DocUpdatesConsumer` — read-only: docs owns no
 *    write frames, so any client frame that is not protocol answers
 *    `error{bad_type}`.
 *
 * It refuses to answer anything else — a fake more forgiving than the server
 * is a fake that hides the bug.
 */

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

/** `stapel_docs.realtime.update_payload`, field for field. The `update` is
 * base64 of the row's opaque bytes; tests use marker strings, because the
 * transport is byte-blind by design. */
export function docUpdatePayload(options: {
  readonly update: string;
  readonly authorId?: string | null;
  readonly clientId?: string;
}): Record<string, unknown> {
  return {
    update: btoa(options.update),
    author_id: options.authorId ?? null,
    client_id: options.clientId ?? "",
  };
}

// ── the transport double (environment edge) ─────────────────────────────────

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
  /** Put the real (jsdom) `WebSocket` back. */
  restore(): void;
}

/**
 * Replace `globalThis.WebSocket` for the duration of a test. The code under
 * test is untouched: `@stapel/realtime`'s `browserSocketFactory` still runs,
 * still decides what to construct, and this only records the call.
 */
export function installBrowserWebSocket(): BrowserWebSocketEnvironment {
  // `defineProperty`, not assignment: msw's interceptors install their own
  // WebSocket with `writable: false`, and a plain assignment throws.
  const original = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");
  ConstructedSocket.opened.length = 0;
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: ConstructedSocket as unknown as typeof WebSocket,
  });
  return {
    sockets: ConstructedSocket.opened,
    last: () => {
      const socket = ConstructedSocket.opened[ConstructedSocket.opened.length - 1];
      if (socket === undefined) throw new Error("no WebSocket was constructed");
      return socket;
    },
    restore: () => {
      if (original !== undefined) {
        Object.defineProperty(globalThis, "WebSocket", original);
      }
      ConstructedSocket.opened.length = 0;
    },
  };
}

// ── the consumer, reproduced ────────────────────────────────────────────────

export interface DocsJournalRow {
  readonly seq: number;
  readonly payload: Record<string, unknown>;
}

export interface DocsUpdatesServerOptions {
  readonly stream: string;
  readonly maxReplay?: number;
}

/**
 * Drive one {@link ConstructedSocket} the way `DocUpdatesConsumer` drives a
 * real one. Nothing is automatic: a test calls {@link accept} to complete the
 * handshake and {@link pump} to let the server process what the client said.
 */
export class DocsUpdatesServer {
  readonly journal: DocsJournalRow[] = [];
  /** Envelopes the SERVER sent, in order. */
  readonly outbox: Envelope[] = [];
  /** `_max_seq_sent` — the replay/live dedup cursor. */
  private maxSeqSent = 0;
  private handled = 0;
  private helloCursor = 0;
  private helloCount = 0;

  constructor(
    readonly socket: ConstructedSocket,
    private readonly options: DocsUpdatesServerOptions
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

  /** Seed the journal: rows seq 1..count, updates `u1`..`u<count>`. */
  fill(count: number, authorId: string | null = "u-2"): void {
    for (let seq = 1; seq <= count; seq += 1) {
      this.journal.push({
        seq,
        payload: docUpdatePayload({ update: `u${seq}`, authorId }),
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
          break;
        case "ping":
          this.send({ v: WIRE_VERSION, type: "pong", stream: this.stream, payload: {} });
          break;
        default:
          // Docs registers NO write frames — the socket is read-only.
          this.error("bad_type", `unsupported frame type ${frame.type}`);
      }
    }
    this.handled = frames.length;
  }

  /** A row lands on the journal and (dedup allowing) goes out live. */
  append(update: string, options?: {
    readonly authorId?: string | null;
    readonly clientId?: string;
  }): number {
    const seq = this.serverSeq + 1;
    const payload = docUpdatePayload({
      update,
      authorId: options?.authorId ?? null,
      ...(options?.clientId !== undefined ? { clientId: options.clientId } : {}),
    });
    this.journal.push({ seq, payload });
    if (this.socket.opened && seq > this.maxSeqSent) {
      this.maxSeqSent = seq;
      this.send({ v: WIRE_VERSION, type: "live", stream: this.stream, payload, seq });
    }
    return seq;
  }

  /** Deliver a live frame VERBATIM (the dedup/duplicate cases). */
  deliverLive(seq: number, payload: Record<string, unknown>): void {
    this.send({ v: WIRE_VERSION, type: "live", stream: this.stream, payload, seq });
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
      this.maxSeqSent = serverSeq;
      return;
    }
    for (const row of this.journal) {
      if (row.seq <= lastSeq) continue;
      this.maxSeqSent = Math.max(this.maxSeqSent, row.seq);
      this.send({
        v: WIRE_VERSION,
        type: "replay",
        stream: this.stream,
        payload: row.payload,
        seq: row.seq,
      });
    }
    this.send({
      v: WIRE_VERSION,
      type: "replay_done",
      stream: this.stream,
      payload: { up_to_seq: this.maxSeqSent },
    });
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
}
