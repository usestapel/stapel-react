/**
 * The thread store: a merged, `seq`-ordered window over a conversation, and
 * the four pure functions that move it.
 *
 * WHY A WINDOW AND NOT A PAGE LIST. A chat thread grows at BOTH ends: older
 * history is paged backwards on scroll, new messages arrive at the tip while
 * the reader is looking at it. TanStack's bidirectional infinite query cannot
 * express the second half — `getPreviousPageParam` is answered from the page
 * the server sent, and at the tip the server correctly says "no previous
 * page", which would freeze the tail forever. So the thread is ONE cache
 * entry holding a contiguous run of messages, and the two directions are two
 * merges into it.
 *
 * THE ORDERING RULE IS THE BACKEND'S, NOT OURS. `seq` is a gapless, total
 * per-conversation order (`stapel-chat/MODULE.md`: "seq is gapless and total
 * — the canonical anchor for history and the resume cursor for realtime"), and
 * ordering by timestamp is an explicit anti-pattern there: two messages in the
 * same millisecond still have a definite order. Everything below therefore
 * sorts, dedupes and detects gaps by `seq` alone.
 *
 * ONE MORE THING THE PAGINATOR MAKES US DO. Item order depends on the
 * DIRECTION asked for: core's `AnchorPagination` returns newest-first for
 * `next` and reverses to oldest-first for `prev` (`pagination.py`,
 * `items[::-1]`). Rather than remember which call produced which order, every
 * merge sorts by `seq` — the total order is cheaper to apply than to
 * remember.
 */
import type { ChatMessage, MessagePage } from "../api/types.js";

/**
 * A contiguous run of messages, ascending by `seq`.
 *
 * "Contiguous" is load-bearing: because `seq` is gapless, a window whose seqs
 * are consecutive integers provably has no hole in it. Every merge below
 * either preserves that or refuses the merge and reports a gap — it never
 * quietly stitches two runs with a hole between them, which is the defect
 * that makes a chat show yesterday's message under today's.
 */
export interface ChatThreadWindow {
  /** Ascending by `seq`, no duplicates, no holes. */
  readonly messages: readonly ChatMessage[];
  /** Older history exists before `messages[0]`. */
  readonly hasOlder: boolean;
  /** Anchor for the next backfill page (`direction=next`), if any. */
  readonly olderAnchor: string | null;
}

/** A merge that either advanced the window, or found a hole and refused. */
export interface ThreadMergeResult {
  readonly window: ChatThreadWindow;
  /**
   * `true` when the incoming messages do not touch the window's tip: more
   * arrived than one page holds. The caller re-hydrates (the REST twin of the
   * socket's `error{resync}`) rather than rendering a thread with a hole.
   */
  readonly gap: boolean;
}

export const EMPTY_THREAD_WINDOW: ChatThreadWindow = {
  messages: [],
  hasOlder: false,
  olderAnchor: null,
};

function ascending(items: readonly ChatMessage[]): ChatMessage[] {
  return [...items].sort((a, b) => a.seq - b.seq);
}

/** The tip: the highest `seq` in the window, or 0 for an empty one. */
export function threadLastSeq(window: ChatThreadWindow): number {
  const last = window.messages[window.messages.length - 1];
  return last ? last.seq : 0;
}

/** The oldest `seq` in the window, or 0 for an empty one. */
export function threadFirstSeq(window: ChatThreadWindow): number {
  const first = window.messages[0];
  return first ? first.seq : 0;
}

/**
 * A fresh window from the newest page (`GET …/messages` with no anchor).
 * This is also the resync path: whatever was loaded before is dropped,
 * because a window that cannot be proven contiguous is worse than a short
 * one.
 */
export function threadWindowFromPage(page: MessagePage): ChatThreadWindow {
  return {
    messages: ascending(page.items),
    hasOlder: page.has_next,
    olderAnchor: page.next_anchor ?? null,
  };
}

/**
 * Merge a backfill page (`direction=next` from the window's oldest seq) onto
 * the FRONT. Anything at or above the current oldest is dropped as a
 * duplicate — the anchor is exclusive, so this only fires on a retry.
 */
export function mergeOlderPage(
  window: ChatThreadWindow,
  page: MessagePage
): ChatThreadWindow {
  const first = threadFirstSeq(window);
  const older = ascending(page.items).filter(
    (message) => first === 0 || message.seq < first
  );
  if (older.length === 0) {
    return { ...window, hasOlder: page.has_next, olderAnchor: page.next_anchor ?? null };
  }
  return {
    messages: [...older, ...window.messages],
    hasOlder: page.has_next,
    olderAnchor: page.next_anchor ?? null,
  };
}

/**
 * Merge a tail page (`direction=prev` anchored on the window's tip) onto the
 * END — the poll-by-seq step.
 *
 * Two independent hole detectors, because either one alone can be fooled:
 *  - the seq test (`first new seq === tip + 1`), which is only meaningful
 *    because seq is gapless;
 *  - the paginator's own `has_prev`, which is how a window that was TRUNCATED
 *    (more messages above the anchor than `limit`) says so.
 */
export function mergeNewerPage(
  window: ChatThreadWindow,
  page: MessagePage
): ThreadMergeResult {
  const tip = threadLastSeq(window);
  const newer = ascending(page.items).filter((message) => message.seq > tip);
  if (newer.length === 0) {
    // Nothing new. `has_prev` cannot be trusted to mean anything here — there
    // is no window to be truncated — so this is simply "still up to date".
    return { window, gap: false };
  }
  const firstNew = newer[0];
  // `tip + 1` also covers the empty window: the first message of a
  // conversation is seq 1, so a page starting at 5 into an empty thread is a
  // hole, not a beginning.
  const contiguous = firstNew !== undefined && firstNew.seq === tip + 1;
  if (!contiguous || page.has_prev) {
    return { window, gap: true };
  }
  return {
    window: { ...window, messages: [...window.messages, ...newer] },
    gap: false,
  };
}

/**
 * Merge ONE message onto the end — a live socket frame, or the row a `send`
 * just returned.
 *
 * Already-known seq is dropped (the socket dedupes too, but the sender's own
 * REST answer and the frame it fans out to itself are two paths to the same
 * row, and only this rule makes them idempotent). A seq beyond the tip + 1 is
 * a hole: the window is left untouched and the caller re-hydrates.
 */
export function mergeMessage(
  window: ChatThreadWindow,
  message: ChatMessage
): ThreadMergeResult {
  const tip = threadLastSeq(window);
  if (message.seq <= tip) return { window, gap: false };
  if (message.seq !== tip + 1) return { window, gap: true };
  return {
    window: { ...window, messages: [...window.messages, message] },
    gap: false,
  };
}
