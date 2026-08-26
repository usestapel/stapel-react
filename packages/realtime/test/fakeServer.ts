/**
 * A fake server that speaks the REAL wire, plus the plumbing to drive it.
 *
 * The frames below are copied from `stapel-realtime`'s own suite
 * (`tests/test_envelope.py`, `tests/test_consumers_resumable.py`) and from
 * `stapel-chat/MODULE.md` §"The wire contract". `JournalConsumer` reproduces
 * `ResumableStreamConsumer.on_hello` line for line — welcome, the bounded
 * replay, the resync verdict, the `seq` dedup — and `heartbeat()` reproduces
 * `_heartbeat_loop`, including the 4408 it closes with when no `pong` arrives.
 *
 * A fake that answers whatever the client happens to send proves nothing; this
 * one refuses to.
 */
import type { RealtimeSocket, RealtimeSocketFactory, RealtimeSocketHandlers } from "../src/index.js";
import type { Cancel, Schedule } from "../src/index.js";

export const STREAM = "chat:conv:7";

export interface Envelope {
  v: number;
  type: string;
  stream?: string;
  payload?: Record<string, unknown>;
  seq?: number;
}

export function welcomeFrame(stream: string, serverSeq: number): Envelope {
  return { v: 1, type: "welcome", stream, payload: { server_seq: serverSeq } };
}

export function ephemeralWelcome(stream: string): Envelope {
  return { v: 1, type: "welcome", stream, payload: { ephemeral: true } };
}

export function replayFrame(stream: string, seq: number, body: string): Envelope {
  return { v: 1, type: "replay", stream, payload: { body, seq }, seq };
}

export function replayDone(stream: string, upToSeq: number): Envelope {
  return { v: 1, type: "replay_done", stream, payload: { up_to_seq: upToSeq } };
}

export function liveFrame(
  stream: string,
  seq: number,
  payload: Record<string, unknown>
): Envelope {
  return { v: 1, type: "live", stream, payload, seq };
}

export function resyncFrame(
  stream: string,
  gap: number,
  window: number,
  serverSeq: number
): Envelope {
  return {
    v: 1,
    type: "resync",
    stream,
    payload: { gap, window, server_seq: serverSeq },
  };
}

export function kickFrame(stream: string, reason: string): Envelope {
  return { v: 1, type: "kick", stream, payload: { reason } };
}

export function errorFrame(stream: string, code: string, message: string): Envelope {
  return { v: 1, type: "error", stream, payload: { code, message } };
}

export function pingEnvelope(stream: string): Envelope {
  return { v: 1, type: "ping", stream, payload: {} };
}

/** A chat signal — a module's own type, and structurally without a `seq`. */
export function signalFrame(
  stream: string,
  type: string,
  payload: Record<string, unknown>
): Envelope {
  return { v: 1, type, stream, payload };
}

// ── the transport double ────────────────────────────────────────────────────

export class FakeSocket {
  public readonly sent: string[] = [];
  public closedByClient = false;
  public opened = false;

  constructor(
    public readonly url: string,
    public readonly handlers: RealtimeSocketHandlers,
    public readonly protocols: readonly string[] | undefined
  ) {}

  /** Accept the handshake (never synchronous — a real socket is not either). */
  accept(): void {
    this.opened = true;
    this.handlers.onOpen();
  }

  deliver(envelope: Envelope): void {
    this.handlers.onData(JSON.stringify(envelope));
  }

  deliverRaw(data: unknown): void {
    this.handlers.onData(data);
  }

  serverClose(code: number, reason = ""): void {
    this.opened = false;
    this.handlers.onClose(code, reason);
  }

  /** Every frame the CLIENT sent, decoded. */
  received(): Envelope[] {
    return this.sent.map((text) => JSON.parse(text) as Envelope);
  }

  receivedOfType(type: string): Envelope[] {
    return this.received().filter((frame) => frame.type === type);
  }
}

export interface FakeTransport {
  readonly factory: RealtimeSocketFactory;
  readonly sockets: FakeSocket[];
  last(): FakeSocket;
}

export function fakeTransport(): FakeTransport {
  const sockets: FakeSocket[] = [];
  const factory: RealtimeSocketFactory = (url, handlers, protocols) => {
    const fake = new FakeSocket(url, handlers, protocols);
    sockets.push(fake);
    const socket: RealtimeSocket = {
      send: (payload) => {
        fake.sent.push(payload);
      },
      close: () => {
        fake.closedByClient = true;
        fake.opened = false;
      },
    };
    return socket;
  };
  return {
    factory,
    sockets,
    last: () => {
      const socket = sockets[sockets.length - 1];
      if (socket === undefined) throw new Error("no socket was opened");
      return socket;
    },
  };
}

// ── a manual clock ──────────────────────────────────────────────────────────

interface Task {
  readonly id: number;
  readonly fn: () => void;
  readonly ms: number;
  /** Virtual time this task comes due at — `now()` when it was queued + `ms`. */
  readonly at: number;
  cancelled: boolean;
}

export interface ManualClock {
  readonly schedule: Schedule;
  readonly pending: Task[];
  /** The virtual wall clock, for the runtime's `now` seam. */
  now(): number;
  /**
   * Move virtual time forward and run everything that comes due, in due order.
   * Tasks queued by those tasks are run too when they fall inside the window —
   * which is what makes "sit here for thirty seconds" a single call.
   */
  advance(ms: number): void;
  /** Run every task queued right now (tasks they queue in turn are not run). */
  flush(): void;
  /** Run the task queued with a delay of at least `ms`, ignoring the rest. */
  runNext(): number;
}

export function manualClock(start = 1_000_000): ManualClock {
  let nextId = 0;
  let time = start;
  const pending: Task[] = [];
  const schedule: Schedule = (fn, ms): Cancel => {
    const task: Task = { id: (nextId += 1), fn, ms, at: time + ms, cancelled: false };
    pending.push(task);
    return () => {
      task.cancelled = true;
    };
  };
  return {
    schedule,
    pending,
    now: () => time,
    advance(ms) {
      const target = time + ms;
      for (;;) {
        let due: Task | undefined;
        let index = -1;
        for (let i = 0; i < pending.length; i += 1) {
          const task = pending[i];
          if (task === undefined || task.cancelled || task.at > target) continue;
          if (due === undefined || task.at < due.at) {
            due = task;
            index = i;
          }
        }
        if (due === undefined) break;
        pending.splice(index, 1);
        time = Math.max(time, due.at);
        due.fn();
      }
      time = target;
    },
    flush() {
      const batch = pending.splice(0, pending.length);
      for (const task of batch) if (!task.cancelled) task.fn();
    },
    runNext() {
      // Cancelled tasks stay in the array (a real timer queue forgets them;
      // this one keeps them so a test can assert nothing live is pending).
      for (;;) {
        const task = pending.shift();
        if (task === undefined) throw new Error("nothing scheduled");
        if (task.cancelled) continue;
        task.fn();
        return task.ms;
      }
    },
  };
}

// ── the resumable consumer, reproduced ──────────────────────────────────────

export interface JournalRow {
  readonly seq: number;
  readonly payload: Record<string, unknown>;
}

export interface FakeServerOptions {
  readonly stream?: string;
  readonly maxReplay?: number;
  readonly ephemeral?: boolean;
}

/**
 * Drive one {@link FakeSocket} the way `ResumableStreamConsumer` drives a real
 * one: answer `hello` with welcome/replay/replay_done (or `resync` past the
 * window), dedup journal frames by `seq`, and answer `ping` with `pong`.
 */
export class FakeServer {
  public readonly journal: JournalRow[] = [];
  private maxSeqSent = 0;
  private pongPending = false;
  private cursor = 0;

  constructor(
    private readonly socket: FakeSocket,
    private readonly options: FakeServerOptions = {}
  ) {}

  private get stream(): string {
    return this.options.stream ?? STREAM;
  }

  fill(count: number, start = 1): void {
    for (let n = start; n < start + count; n += 1) {
      this.journal.push({ seq: n, payload: { body: `m${n}`, seq: n } });
    }
  }

  get serverSeq(): number {
    return this.journal.length === 0 ? 0 : (this.journal[this.journal.length - 1]?.seq ?? 0);
  }

  /** The `last_seq` the client asked to resume from, on its latest hello. */
  get lastHelloCursor(): number {
    return this.cursor;
  }

  /** Process every client frame that has arrived since the last call. */
  pump(): void {
    const frames = this.socket.received();
    for (let index = this.handled; index < frames.length; index += 1) {
      const frame = frames[index];
      if (frame === undefined) continue;
      if (frame.type === "hello") this.onHello(frame);
      else if (frame.type === "ping") this.send({ v: 1, type: "pong", stream: this.stream, payload: {} });
      else if (frame.type === "pong") this.pongPending = false;
    }
    this.handled = frames.length;
  }

  private handled = 0;

  private onHello(frame: Envelope): void {
    const raw = frame.payload?.["last_seq"];
    const lastSeq = typeof raw === "number" ? Math.max(0, raw) : 0;
    this.cursor = lastSeq;
    if (this.options.ephemeral === true) {
      this.send(ephemeralWelcome(this.stream));
      return;
    }
    const serverSeq = this.serverSeq;
    this.send(welcomeFrame(this.stream, serverSeq));
    this.maxSeqSent = Math.max(this.maxSeqSent, lastSeq);
    const limit = this.options.maxReplay ?? 500;
    if (serverSeq - lastSeq > limit) {
      this.send(resyncFrame(this.stream, serverSeq - lastSeq, limit, serverSeq));
      return;
    }
    for (const row of this.journal.filter((r) => r.seq > lastSeq).slice(0, limit)) {
      this.sendJournal("replay", row.seq, row.payload);
    }
    this.send(replayDone(this.stream, serverSeq));
  }

  /** Fan a committed row out as a `live` frame (dedup included). */
  publish(seq: number, payload: Record<string, unknown>): void {
    this.journal.push({ seq, payload });
    this.sendJournal("live", seq, payload);
  }

  private sendJournal(type: string, seq: number, payload: Record<string, unknown>): void {
    if (seq <= this.maxSeqSent) return; // consumers.py:send_frame dedup
    this.maxSeqSent = seq;
    this.send({ v: 1, type, stream: this.stream, payload, seq });
  }

  send(envelope: Envelope): void {
    this.socket.deliver(envelope);
  }

  /** One heartbeat tick: ping, then close 4408 if no pong came back. */
  heartbeat(): void {
    this.pongPending = true;
    this.send(pingEnvelope(this.stream));
    this.pump();
    if (this.pongPending) this.socket.serverClose(4408);
  }
}
