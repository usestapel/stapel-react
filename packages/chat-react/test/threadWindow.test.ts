/**
 * The thread store's four merges — no holes, no duplicates, one order.
 *
 * This is the file the storefront spec's chat line points at ("polling by seq
 * with no gaps and no duplicates"): the merges are pure, so the invariant can
 * be asserted directly instead of inferred from a rendered list.
 */
import { describe, expect, it } from "vitest";
import {
  EMPTY_THREAD_WINDOW,
  applyRevision,
  mergeMessage,
  mergeNewerPage,
  mergeOlderPage,
  threadFirstSeq,
  threadLastRevSeq,
  threadLastSeq,
  threadWindowFromPage,
} from "../src/index.js";
import type { ChatThreadWindow } from "../src/index.js";
import { message, messagePage } from "./fixtures.js";

/** The invariant the whole store exists to keep: a contiguous seq run. */
function seqs(window: ChatThreadWindow): number[] {
  return window.messages.map((m) => m.seq);
}
function isContiguousAscending(window: ChatThreadWindow): boolean {
  const values = seqs(window);
  return values.every((seq, index) => index === 0 || seq === (values[index - 1] ?? 0) + 1);
}

describe("the newest page becomes the window", () => {
  it("sorts a newest-first page into ascending seq order", () => {
    const window = threadWindowFromPage(messagePage([3, 2, 1]));
    expect(seqs(window)).toEqual([1, 2, 3]);
    expect(threadLastSeq(window)).toBe(3);
    expect(threadFirstSeq(window)).toBe(1);
  });

  it("carries the backfill anchor from the page", () => {
    const window = threadWindowFromPage(
      messagePage([5, 4, 3], { has_next: true, next_anchor: "3" })
    );
    expect(window.hasOlder).toBe(true);
    expect(window.olderAnchor).toBe("3");
  });

  it("an empty thread is an empty window, not a missing one", () => {
    const window = threadWindowFromPage(messagePage([]));
    expect(window.messages).toEqual([]);
    expect(threadLastSeq(window)).toBe(0);
  });
});

describe("the tail merge — polling by seq", () => {
  it("appends the messages after the tip, in order, with no gap", () => {
    const window = threadWindowFromPage(messagePage([3, 2, 1]));
    // A `prev` page arrives OLDEST-first; the merge must not care.
    const merged = mergeNewerPage(window, messagePage([4, 5], { direction: "prev" }));
    expect(merged.gap).toBe(false);
    expect(seqs(merged.window)).toEqual([1, 2, 3, 4, 5]);
    expect(isContiguousAscending(merged.window)).toBe(true);
  });

  it("drops a message it already holds instead of duplicating it", () => {
    const window = threadWindowFromPage(messagePage([3, 2, 1]));
    const merged = mergeNewerPage(
      window,
      messagePage([2, 3, 4], { direction: "prev" })
    );
    expect(merged.gap).toBe(false);
    expect(seqs(merged.window)).toEqual([1, 2, 3, 4]);
  });

  it("an empty tail leaves the window exactly as it was", () => {
    const window = threadWindowFromPage(messagePage([3, 2, 1]));
    const merged = mergeNewerPage(window, messagePage([], { direction: "prev" }));
    expect(merged.gap).toBe(false);
    expect(merged.window).toBe(window);
  });

  it("REFUSES a page that does not touch the tip — that is a hole", () => {
    const window = threadWindowFromPage(messagePage([3, 2, 1]));
    const merged = mergeNewerPage(
      window,
      // seq 4 is missing: 5 is not tip + 1.
      messagePage([5, 6], { direction: "prev" })
    );
    expect(merged.gap).toBe(true);
    expect(seqs(merged.window)).toEqual([1, 2, 3]);
  });

  it("REFUSES a truncated page even when its first seq looks contiguous", () => {
    // `has_prev` is how the paginator says "this window was cut": there were
    // more messages above the anchor than the limit. Trusting the seq test
    // alone here would stitch a hole shut and never notice.
    const window = threadWindowFromPage(messagePage([3, 2, 1]));
    const merged = mergeNewerPage(
      window,
      messagePage([4, 5], { direction: "prev", has_prev: true })
    );
    expect(merged.gap).toBe(true);
  });

  it("a page into an empty window must start at seq 1", () => {
    const fresh = mergeNewerPage(
      EMPTY_THREAD_WINDOW,
      messagePage([5, 6], { direction: "prev" })
    );
    expect(fresh.gap).toBe(true);
    const first = mergeNewerPage(
      EMPTY_THREAD_WINDOW,
      messagePage([1, 2], { direction: "prev" })
    );
    expect(first.gap).toBe(false);
    expect(seqs(first.window)).toEqual([1, 2]);
  });
});

describe("the backfill merge", () => {
  it("prepends older history and moves the anchor", () => {
    const window = threadWindowFromPage(
      messagePage([5, 4], { has_next: true, next_anchor: "4" })
    );
    const merged = mergeOlderPage(
      window,
      messagePage([3, 2, 1], { has_next: false, next_anchor: null })
    );
    expect(seqs(merged)).toEqual([1, 2, 3, 4, 5]);
    expect(isContiguousAscending(merged)).toBe(true);
    expect(merged.hasOlder).toBe(false);
    expect(merged.olderAnchor).toBeNull();
  });

  it("re-delivering the same page changes nothing but the flags", () => {
    const window = threadWindowFromPage(
      messagePage([3, 2, 1], { has_next: true, next_anchor: "1" })
    );
    const merged = mergeOlderPage(window, messagePage([3, 2, 1]));
    expect(seqs(merged)).toEqual([1, 2, 3]);
    expect(merged.hasOlder).toBe(false);
  });
});

describe("one message at a time — the socket frame and the send answer", () => {
  it("appends the next seq", () => {
    const window = threadWindowFromPage(messagePage([2, 1]));
    const merged = mergeMessage(window, message(3));
    expect(merged.gap).toBe(false);
    expect(seqs(merged.window)).toEqual([1, 2, 3]);
  });

  it("drops one it already has — the sender's own REST answer and the socket's fan-out are the same row", () => {
    const window = threadWindowFromPage(messagePage([3, 2, 1]));
    const merged = mergeMessage(window, message(3));
    expect(merged.gap).toBe(false);
    expect(merged.window).toBe(window);
  });

  it("reports a hole rather than jumping the queue", () => {
    const window = threadWindowFromPage(messagePage([2, 1]));
    const merged = mergeMessage(window, message(7));
    expect(merged.gap).toBe(true);
    expect(seqs(merged.window)).toEqual([1, 2]);
  });
});

describe("the RESUME CURSOR is rev_seq, and it is a max, not a last", () => {
  it("an untouched thread has rev_seq === seq at the tip", () => {
    const window = threadWindowFromPage(messagePage([3, 2, 1]));
    expect(threadLastSeq(window)).toBe(3);
    expect(threadLastRevSeq(window)).toBe(3);
  });

  it("an EDITED old message carries the newest rev_seq while staying in place", () => {
    // This is the whole reason the two numbers are different fields. Reading
    // the last element's rev_seq would resume from 3 and re-receive the edit
    // forever; reading `seq` would ask the server to replay from a revision
    // number that has nothing to do with what we hold.
    const window: ChatThreadWindow = {
      messages: [message(1, { rev_seq: 9 }), message(2), message(3)],
      hasOlder: false,
      olderAnchor: null,
    };
    expect(threadLastSeq(window)).toBe(3);
    expect(threadLastRevSeq(window)).toBe(9);
  });

  it("an empty window resumes from zero — replay everything", () => {
    expect(threadLastRevSeq(EMPTY_THREAD_WINDOW)).toBe(0);
  });
});

describe("a revision lands where no anchored refetch can reach it", () => {
  it("rewrites the body in place and keeps the thread's order", () => {
    const window = threadWindowFromPage(messagePage([3, 2, 1]));
    const next = applyRevision(window, {
      message_id: "m-2",
      rev_seq: 4,
      body: "fixed a typo",
      edited: true,
      edited_at: "2026-08-26T18:30:00Z",
      deleted: false,
      deleted_at: null,
    });
    expect(seqs(next)).toEqual([1, 2, 3]);
    expect(next.messages[1]).toMatchObject({
      id: "m-2",
      seq: 2,
      rev_seq: 4,
      body: "fixed a typo",
      edited: true,
    });
  });

  it("a tombstone keeps the id and the seq, and loses everything readable", () => {
    const window = threadWindowFromPage(messagePage([2, 1]));
    const next = applyRevision(window, {
      message_id: "m-1",
      rev_seq: 5,
      body: "",
      edited: false,
      edited_at: null,
      deleted: true,
      deleted_at: "2026-08-26T18:31:00Z",
    });
    // The id keeps arriving so a cache knows which row to purge — an id that
    // stops arriving is an id nobody can purge.
    expect(next.messages[0]).toMatchObject({
      id: "m-1",
      seq: 1,
      body: "",
      deleted: true,
      attachments: [],
    });
    expect(seqs(next)).toEqual([1, 2]);
  });

  it("is idempotent: the replay/live overlap delivers the same revision twice", () => {
    const window = threadWindowFromPage(messagePage([2, 1]));
    const revision = {
      message_id: "m-1",
      rev_seq: 5,
      body: "once",
      edited: true,
      edited_at: null,
      deleted: false,
      deleted_at: null,
    };
    const once = applyRevision(window, revision);
    const twice = applyRevision(once, revision);
    expect(twice).toBe(once);
  });

  it("ignores an id the window does not hold — not ours is not a hole", () => {
    const window = threadWindowFromPage(messagePage([2, 1]));
    const next = applyRevision(window, {
      message_id: "m-900",
      rev_seq: 9,
      body: "from before the window",
      edited: true,
      edited_at: null,
      deleted: false,
      deleted_at: null,
    });
    expect(next).toBe(window);
  });
});
