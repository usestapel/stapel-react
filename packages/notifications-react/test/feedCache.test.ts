/**
 * The four cache transforms, tested as arithmetic.
 *
 * Every screen in this pair that shows read state shows it twice — as dots on
 * rows and as a number above them — and the two come from different halves of
 * the wire (`read_at` on the row, `unread_count` on the page envelope). So the
 * assertions below are almost all about the pair MOVING TOGETHER: a transform
 * that stamped rows and left the badge is the defect this file exists to catch,
 * and it is invisible in any test that only looks at one of them.
 */
import { describe, expect, it } from "vitest";
import {
  applyReadSignal,
  markReadLocally,
  mergeArrivedItem,
  unreadCountOf,
} from "../src/model/feedCache.js";
import type { FeedCache } from "../src/model/feedCache.js";
import type { FeedItem, NotificationFeedPage } from "../src/api/types.js";

const READ_AT = "2026-03-19T12:00:00Z";

function item(id: string, readAt: string | null = null): FeedItem {
  return {
    id,
    notification_type: "new_message",
    title: `Row ${id}`,
    body: "…",
    data: {},
    created_at: "2026-03-17T10:30:00Z",
    read_at: readAt,
  };
}

function page(items: readonly FeedItem[], unread: number): NotificationFeedPage {
  return {
    items: [...items],
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: items.length,
    unread_count: unread,
  };
}

function cache(pages: readonly NotificationFeedPage[]): FeedCache {
  return { pages: [...pages], pageParams: pages.map(() => undefined) };
}

/** Every loaded row, flattened — the list a screen actually draws. */
function rows(result: FeedCache | undefined): readonly FeedItem[] {
  return result?.pages.flatMap((p) => p.items) ?? [];
}

function readAtOf(result: FeedCache | undefined, id: string): string | null | undefined {
  return rows(result).find((row) => row.id === id)?.read_at;
}

describe("markReadLocally — the optimistic stamp", () => {
  it("stamps the named rows and moves the badge by exactly as many as changed", () => {
    const before = cache([page([item("a"), item("b"), item("c")], 3)]);
    const after = markReadLocally(before, { ids: ["a", "c"] }, READ_AT);
    expect(readAtOf(after, "a")).toBe(READ_AT);
    expect(readAtOf(after, "c")).toBe(READ_AT);
    expect(readAtOf(after, "b")).toBeNull();
    expect(unreadCountOf(after)).toBe(1);
  });

  it("counts what CHANGED, not what was asked for — a repeat cannot drive the badge negative", () => {
    // The server's `marked` counts rows that were unread; a client subtracting
    // ids.length would report -1 unread the second time somebody clicks the
    // same already-read row, and a badge cannot un-say a negative number.
    const before = cache([page([item("a", READ_AT), item("b")], 1)]);
    const after = markReadLocally(before, { ids: ["a"] }, "2026-03-19T13:00:00Z");
    expect(unreadCountOf(after)).toBe(1);
    // …and the original timestamp survives, exactly as the idempotent write on
    // the server leaves it alone.
    expect(readAtOf(after, "a")).toBe(READ_AT);
  });

  it("`all` clears the badge outright, because rows this client never loaded are read too", () => {
    const before = cache([page([item("a"), item("b", READ_AT)], 47)]);
    const after = markReadLocally(before, { all: true }, READ_AT);
    expect(unreadCountOf(after)).toBe(0);
    expect(rows(after).every((row) => row.read_at !== null)).toBe(true);
  });

  it("keeps the badge identical on every loaded page", () => {
    const before = cache([page([item("a")], 2), page([item("b")], 2)]);
    const after = markReadLocally(before, { ids: ["a"] }, READ_AT);
    expect(after?.pages.map((p) => p.unread_count)).toEqual([1, 1]);
  });

  it("leaves a cache nobody has read alone rather than inventing a page", () => {
    expect(markReadLocally(undefined, { all: true }, READ_AT)).toBeUndefined();
    const empty = cache([]);
    expect(markReadLocally(empty, { all: true }, READ_AT)).toBe(empty);
  });
});

describe("applyReadSignal — another screen cleared something", () => {
  it("takes the badge from the frame verbatim, not from the loaded rows", () => {
    // The frame's number counts the WHOLE feed; this cache holds one page of
    // it. A client that recomputed from its own rows would report 1 unread
    // for an account with 30.
    const before = cache([page([item("a"), item("b")], 32)]);
    const after = applyReadSignal(
      before,
      { ids: ["a"], all: false, unread_count: 31 },
      READ_AT
    );
    expect(unreadCountOf(after)).toBe(31);
    expect(readAtOf(after, "a")).toBe(READ_AT);
    expect(readAtOf(after, "b")).toBeNull();
  });

  it("`all: true` stamps every loaded row even though the frame names none", () => {
    const before = cache([page([item("a"), item("b")], 2)]);
    const after = applyReadSignal(before, { ids: [], all: true, unread_count: 0 }, READ_AT);
    expect(rows(after).every((row) => row.read_at === READ_AT)).toBe(true);
    expect(unreadCountOf(after)).toBe(0);
  });

  it("never lets a bad frame pin the badge below zero", () => {
    const before = cache([page([item("a")], 1)]);
    const after = applyReadSignal(before, { ids: [], all: false, unread_count: -3 }, READ_AT);
    expect(unreadCountOf(after)).toBe(0);
  });
});

describe("mergeArrivedItem — a delivery, and the badge that follows it", () => {
  it("puts the row on top and raises the badge with it", () => {
    const before = cache([page([item("a", READ_AT)], 0)]);
    const after = mergeArrivedItem(before, item("new"));
    expect(rows(after)[0]?.id).toBe("new");
    expect(unreadCountOf(after)).toBe(1);
    expect(after?.pages[0]?.count).toBe(2);
  });

  it("a row that reached this tab twice is one row and one increment", () => {
    // A socket frame and a poll that raced it deliver the same id. Appending
    // blindly shows it twice AND counts it twice.
    const before = cache([page([item("a")], 1)]);
    const once = mergeArrivedItem(before, item("b"));
    const twice = mergeArrivedItem(once, item("b"));
    expect(rows(twice)).toHaveLength(2);
    expect(unreadCountOf(twice)).toBe(2);
  });

  it("a redelivery that arrives already read does not raise the badge", () => {
    const before = cache([page([item("a")], 1)]);
    const after = mergeArrivedItem(before, item("b", READ_AT));
    expect(rows(after)).toHaveLength(2);
    expect(unreadCountOf(after)).toBe(1);
  });
});

describe("unreadCountOf", () => {
  it("is 0 for a feed nobody has read — not undefined leaking into a badge", () => {
    expect(unreadCountOf(undefined)).toBe(0);
    expect(unreadCountOf(cache([]))).toBe(0);
  });
});
