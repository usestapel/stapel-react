/**
 * The Y.Doc session — the convergence core of the collab slice, tested
 * against the REAL yjs (a devDependency; in production it is an optional
 * peer reached through `import()`).
 *
 * What this suite pins, in the order the design promises it:
 *
 * 1. **Local edits batch to one append**, debounced, under one `client_id`
 *    and a monotonically increasing `client_seq` — the journal's own dedup
 *    handle, so a retried batch can never land twice.
 * 2. **Remote applications are origin-tagged** and never echo back through
 *    the append door.
 * 3. **Two peers converge through the wire** — the whole point of a CRDT
 *    journal, held as an executable property rather than a sentence.
 * 4. **Resync is a merge, not a loss**: the fresh snapshot folds INTO the
 *    live doc, so unsent local edits survive re-hydration and still flush.
 * 5. **A failed flush retries the SAME batch under the SAME `client_seq`**
 *    (an append that actually landed server-side is deduped, not doubled),
 *    and edits made meanwhile go to the NEXT batch.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYDocSession, CONTENT_KEY } from "../src/editors/collab/session.js";
import type {
  CollabAppendBatch,
  CollabTransport,
  YDocSession,
} from "../src/editors/collab/session.js";
import type { YjsModule } from "../src/editors/collab/yjsPeer.js";

const yjs = Y as unknown as YjsModule;

function b64(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return btoa(out);
}

function bytes(encoded: string): Uint8Array {
  const raw = atob(encoded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** A Y state whose `"content"` text is `text` — what `GET /content` serves. */
function serverState(text: string): Uint8Array {
  const doc = new Y.Doc();
  doc.getText(CONTENT_KEY).insert(0, text);
  return Y.encodeStateAsUpdate(doc);
}

/** Manual timers: the debounce fires when the TEST says so. */
function manualSchedule(): {
  schedule: (fn: () => void, ms: number) => () => void;
  run: () => void;
  readonly armed: () => number;
} {
  const queue: (() => void)[] = [];
  return {
    schedule: (fn) => {
      queue.push(fn);
      return () => {
        const index = queue.indexOf(fn);
        if (index >= 0) queue.splice(index, 1);
      };
    },
    run: () => {
      const pending = queue.splice(0, queue.length);
      for (const fn of pending) fn();
    },
    armed: () => queue.length,
  };
}

/** An in-memory journal standing where stapel-docs stands. */
class FakeJournal {
  readonly rows: { seq: number; update: string; client_id: string }[] = [];
  readonly appends: CollabAppendBatch[] = [];
  readonly seen = new Set<string>();
  failNext = 0;
  state: Uint8Array;
  headSeq = 0;

  constructor(initial: Uint8Array) {
    this.state = initial;
  }

  transport(): CollabTransport {
    return {
      hydrate: () => Promise.resolve({ state: this.state, headSeq: this.headSeq }),
      append: (batch) => {
        this.appends.push(batch);
        if (this.failNext > 0) {
          this.failNext -= 1;
          return Promise.reject(new Error("network down"));
        }
        const dedup = `${batch.client_id}:${String(batch.client_seq)}`;
        if (!this.seen.has(dedup)) {
          this.seen.add(dedup);
          for (const update of batch.updates) {
            this.headSeq += 1;
            this.rows.push({
              seq: this.headSeq,
              update,
              client_id: batch.client_id,
            });
            this.state = Y.mergeUpdates([this.state, bytes(update)]);
          }
        }
        return Promise.resolve({ head_seq: this.headSeq });
      },
    };
  }

  /** Deliver every row past `since` to a session, as the stream would. */
  deliverTo(session: YDocSession, since = 0): number {
    for (const row of this.rows) {
      if (row.seq <= since) continue;
      session.applyRemote([
        { seq: row.seq, update: row.update, authorId: null, clientId: row.client_id },
      ]);
    }
    return this.headSeq;
  }
}

function makeSession(
  journal: FakeJournal,
  clientId: string
): { session: YDocSession; timers: ReturnType<typeof manualSchedule> } {
  const timers = manualSchedule();
  const session = createYDocSession({
    yjs,
    transport: journal.transport(),
    clientId,
    schedule: timers.schedule,
  });
  return { session, timers };
}

describe("local edits batch through the append door", () => {
  it("debounces to ONE append with client_id + a monotonic client_seq", async () => {
    const journal = new FakeJournal(serverState(""));
    const { session, timers } = makeSession(journal, "c-a");
    await session.start();

    session.text().insert(0, "a");
    session.text().insert(1, "b");
    session.text().insert(2, "c");
    expect(session.pendingUpdates).toBe(3);
    expect(journal.appends).toHaveLength(0);

    timers.run();
    await session.settle();
    expect(journal.appends).toHaveLength(1);
    const first = journal.appends[0];
    expect(first?.client_id).toBe("c-a");
    expect(first?.client_seq).toBe(1);
    expect(first?.updates).toHaveLength(3);
    expect(session.pendingUpdates).toBe(0);

    session.text().insert(3, "d");
    timers.run();
    await session.settle();
    expect(journal.appends[1]?.client_seq).toBe(2);
  });

  it("a remote application is origin-tagged: nothing echoes back", async () => {
    const journal = new FakeJournal(serverState(""));
    const { session, timers } = makeSession(journal, "c-a");
    await session.start();

    const other = new Y.Doc();
    other.getText(CONTENT_KEY).insert(0, "from elsewhere");
    session.applyRemote([
      {
        seq: 1,
        update: b64(Y.encodeStateAsUpdate(other)),
        authorId: "u-2",
        clientId: "c-b",
      },
    ]);

    expect(session.text().toString()).toBe("from elsewhere");
    expect(session.pendingUpdates).toBe(0);
    timers.run();
    await session.settle();
    expect(journal.appends).toHaveLength(0);
  });

  it("its own journaled rows come back over the stream without duplicating anything", async () => {
    const journal = new FakeJournal(serverState(""));
    const { session, timers } = makeSession(journal, "c-a");
    await session.start();

    session.text().insert(0, "once");
    timers.run();
    await session.settle();
    expect(journal.rows.length).toBeGreaterThan(0);

    // The fan-out sends every row to every subscriber — the author included.
    journal.deliverTo(session);
    expect(session.text().toString()).toBe("once");
    expect(session.pendingUpdates).toBe(0);
  });
});

describe("two peers converge through the wire", () => {
  it("concurrent edits on both sides end as ONE document", async () => {
    const journal = new FakeJournal(serverState("base"));
    const a = makeSession(journal, "c-a");
    const b = makeSession(journal, "c-b");
    await a.session.start();
    await b.session.start();

    a.session.text().insert(4, " from-a");
    b.session.text().insert(0, "from-b ");

    a.timers.run();
    await a.session.settle();
    b.timers.run();
    await b.session.settle();

    journal.deliverTo(a.session);
    journal.deliverTo(b.session);

    expect(a.session.text().toString()).toBe(b.session.text().toString());
    const converged = a.session.text().toString();
    expect(converged).toContain("from-a");
    expect(converged).toContain("from-b");
    expect(converged).toContain("base");
  });
});

describe("resync is a merge, not a loss", () => {
  it("unsent local edits survive re-hydration and still flush", async () => {
    const journal = new FakeJournal(serverState("server"));
    const { session, timers } = makeSession(journal, "c-a");
    await session.start();

    // A local edit that has NOT been flushed when the resync order lands.
    session.text().insert(6, " +local");
    expect(session.pendingUpdates).toBeGreaterThan(0);

    // Meanwhile the server moved: someone else's edit is already folded in.
    const other = new Y.Doc();
    Y.applyUpdate(other, journal.state);
    other.getText(CONTENT_KEY).insert(0, "other> ");
    journal.state = Y.encodeStateAsUpdate(other);
    journal.headSeq = 41;

    const headSeq = await session.resync();
    expect(headSeq).toBe(41);
    // Both survive: the fresh snapshot AND the unsent local edit.
    expect(session.text().toString()).toContain("other> ");
    expect(session.text().toString()).toContain("+local");
    expect(session.pendingUpdates).toBeGreaterThan(0);

    timers.run();
    await session.settle();
    expect(session.pendingUpdates).toBe(0);
    expect(journal.appends.length).toBeGreaterThan(0);
  });
});

describe("a failed flush is retried, never doubled", () => {
  it("retries the SAME batch under the SAME client_seq; later edits take the NEXT", async () => {
    const journal = new FakeJournal(serverState(""));
    const { session, timers } = makeSession(journal, "c-a");
    await session.start();

    session.text().insert(0, "x");
    journal.failNext = 1;
    timers.run();
    await session.settle();
    expect(journal.appends).toHaveLength(1);
    expect(session.pendingUpdates).toBe(1);

    // An edit made while the first batch is stranded.
    session.text().insert(1, "y");

    timers.run();
    await session.settle();
    timers.run();
    await session.settle();

    // The stranded batch went out again UNDER ITS OWN client_seq…
    const seqs = journal.appends.map((batch) => batch.client_seq);
    expect(seqs[0]).toBe(1);
    expect(seqs[1]).toBe(1);
    // …and the later edit was not folded into it (dedup would drop it).
    expect(journal.appends[1]?.updates).toEqual(journal.appends[0]?.updates);
    expect(seqs).toContain(2);
    expect(session.pendingUpdates).toBe(0);
    expect(journal.rows.map((row) => row.seq)).toEqual([1, 2]);
  });
});
