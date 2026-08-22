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
  mergeMessage,
  mergeNewerPage,
  mergeOlderPage,
  threadFirstSeq,
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
