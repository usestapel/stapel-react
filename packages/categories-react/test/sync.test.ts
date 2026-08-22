/**
 * The delta protocol — the spec's named acceptance (§8.2: a delta by
 * `min_revision`; dropping `deleted: true`) plus the two rules the module's
 * own documentation does not state.
 */
import { describe, expect, it } from "vitest";
import {
  EMPTY_SNAPSHOT,
  MAX_SYNC_PAGES,
  applyCategoryPage,
  buildCategoryTree,
  createCategoriesApi,
  firstPageRequest,
  isEmptySnapshot,
  nextPageRequest,
  parseSnapshot,
  syncCatalog,
} from "../src/index.js";
import type { CategorySnapshot } from "../src/index.js";
import { createStapelClient } from "@stapel/core";
import { BASE, mockServer } from "./harness.js";
import { FULL_PAGE, LAPTOPS, PHONES, ROWS, categoryRow, page } from "./fixtures.js";

function apiOver(server: ReturnType<typeof mockServer>) {
  return createCategoriesApi(
    createStapelClient({ baseUrl: BASE, fetch: server.fetch })
  );
}

describe("the request a sync starts with", () => {
  it("cold: everything, with the tombstones left out", () => {
    // Nothing is cached, so a tombstone has nothing to evict.
    expect(firstPageRequest(EMPTY_SNAPSHOT)).toEqual({
      includeDeleted: false,
      page: 1,
    });
  });

  it("warm: the delta, with the tombstones IN", () => {
    const stored: CategorySnapshot = { version: 1, cursor: 42, rows: [...ROWS] };
    expect(firstPageRequest(stored)).toEqual({
      minRevision: 42,
      includeDeleted: true,
      page: 1,
    });
  });

  it("treats a cursor with no rows as cold", () => {
    expect(isEmptySnapshot({ version: 1, cursor: 99, rows: [] })).toBe(true);
  });
});

describe("paging a walk", () => {
  it("stops when the server says there is no next page", () => {
    expect(nextPageRequest({ page: 1 }, FULL_PAGE)).toBeUndefined();
  });

  it("PINS the window with max_revision on the second page", () => {
    // Pages are ordered by revision and filtered at request time: a write
    // landing between page 1 and page 2 shifts every later boundary and the
    // walk silently skips a row. `max_revision` exists for this and the
    // module's documented sync flow never mentions it.
    const first = page(ROWS.slice(0, 2), {
      page: 1,
      totalPages: 2,
      hasNext: true,
      globalMax: 7,
    });
    expect(nextPageRequest({ page: 1 }, first)).toEqual({
      page: 2,
      maxRevision: 7,
    });
  });

  it("keeps the ORIGINAL pin when a later page reports a newer global_max", () => {
    const later = page(ROWS.slice(2, 4), {
      page: 2,
      totalPages: 3,
      hasNext: true,
      globalMax: 900,
    });
    expect(nextPageRequest({ page: 2, maxRevision: 7 }, later)).toEqual({
      page: 3,
      maxRevision: 7,
    });
  });
});

describe("folding a page into a snapshot", () => {
  it("adds and replaces rows by id", () => {
    const first = applyCategoryPage(EMPTY_SNAPSHOT, FULL_PAGE);
    expect(first.rows).toHaveLength(6);
    const renamed = { ...PHONES, name: "category.mobiles", revision: 11 };
    const second = applyCategoryPage(first, page([renamed], { globalMax: 11 }));
    expect(second.rows).toHaveLength(6);
    expect(second.rows.find((r) => r.id === 2)?.name).toBe("category.mobiles");
  });

  it("drops a row that arrives with deleted: true", () => {
    const first = applyCategoryPage(EMPTY_SNAPSHOT, FULL_PAGE);
    const tomb = { ...LAPTOPS, deleted: true, revision: 12 };
    const after = applyCategoryPage(first, page([tomb], { globalMax: 12 }));
    expect(after.rows.some((r) => r.id === 3)).toBe(false);
  });

  it("applies revisions.deleted_ids even when no row carried the tombstone", () => {
    // THE reason deleted_ids is the authoritative channel: the rows are
    // paginated, so a tombstone can sit on a page the walk never reached,
    // while deleted_ids is computed unpaginated over the whole table.
    const first = applyCategoryPage(EMPTY_SNAPSHOT, FULL_PAGE);
    const after = applyCategoryPage(
      first,
      page([], { globalMax: 13, deletedIds: [3, 4] })
    );
    expect(after.rows.map((r) => r.id).sort()).toEqual([1, 2, 5, 6]);
  });

  it("never moves the cursor backwards", () => {
    const held: CategorySnapshot = { version: 1, cursor: 50, rows: [] };
    expect(applyCategoryPage(held, page([], { globalMax: 7 })).cursor).toBe(50);
  });

  it("never records reading past the pinned window", () => {
    // global_max is the table's LIVE maximum, which can already exceed the
    // window the walk pinned. Taking it verbatim would skip everything
    // written during the walk.
    const folded = applyCategoryPage(
      EMPTY_SNAPSHOT,
      page(ROWS.slice(0, 1), { globalMax: 900 }),
      { cursorLimit: 7 }
    );
    expect(folded.cursor).toBe(7);
  });
});

describe("a snapshot read back from persistence", () => {
  it("accepts what it wrote", () => {
    const written = applyCategoryPage(EMPTY_SNAPSHOT, FULL_PAGE);
    expect(parseSnapshot(JSON.parse(JSON.stringify(written)))).toEqual(written);
  });

  it("rejects junk rather than throwing at the caller", () => {
    // A cache that throws on read is worse than no cache.
    for (const junk of [
      undefined,
      null,
      42,
      "snapshot",
      {},
      { version: 2, cursor: 1, rows: [] },
      { version: 1, cursor: "one", rows: [] },
      { version: 1, cursor: 1, rows: "many" },
      { version: 1, cursor: 1, rows: [{ slug: "no-id" }] },
    ]) {
      expect(parseSnapshot(junk)).toBeUndefined();
    }
  });
});

describe("syncCatalog — the walk", () => {
  it("cold-syncs in one request when one page is enough", async () => {
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
    const result = await syncCatalog(apiOver(server), EMPTY_SNAPSHOT);

    expect(result.wasFullSync).toBe(true);
    expect(result.pages).toBe(1);
    expect(result.snapshot.cursor).toBe(7);
    const query = server.lastQuery("/categories/");
    expect(query?.get("include_deleted")).toBe("false");
    expect(query?.get("min_revision")).toBeNull();
  });

  it("sends min_revision on a warm start, and include_deleted=true", async () => {
    const server = mockServer({
      "/categories/": { body: page([], { globalMax: 7 }) },
    });
    const stored: CategorySnapshot = { version: 1, cursor: 7, rows: [...ROWS] };
    const result = await syncCatalog(apiOver(server), stored);

    expect(result.wasFullSync).toBe(false);
    const query = server.lastQuery("/categories/");
    expect(query?.get("min_revision")).toBe("7");
    expect(query?.get("include_deleted")).toBe("true");
    // Nothing changed, so nothing moved.
    expect(result.snapshot.rows).toHaveLength(ROWS.length);
  });

  it("walks every page and pins the window from the first one", async () => {
    const pages = [
      page(ROWS.slice(0, 3), { page: 1, totalPages: 2, hasNext: true, globalMax: 7 }),
      page(ROWS.slice(3, 6), { page: 2, totalPages: 2, hasNext: false, globalMax: 9 }),
    ];
    let n = 0;
    const server = mockServer({
      "/categories/": () => ({ body: pages[n++] ?? pages[1] }),
    });
    const result = await syncCatalog(apiOver(server), EMPTY_SNAPSHOT);

    expect(result.pages).toBe(2);
    const queries = server.queries("/categories/");
    expect(queries[0]?.get("max_revision")).toBeNull();
    expect(queries[1]?.get("max_revision")).toBe("7");
    expect(queries[1]?.get("page")).toBe("2");
    // The table moved to 9 while the walk read window 7. Recording 9 would
    // mean claiming to have read rows the walk never asked for.
    expect(result.snapshot.cursor).toBe(7);
  });

  it("a full sync does NOT inherit rows the server stopped listing", async () => {
    const stored: CategorySnapshot = {
      version: 1,
      cursor: 0,
      rows: [categoryRow(500, "stale", "category.stale", null, "", "")],
    };
    // cursor 0 + rows present is a warm snapshot, so force the cold path by
    // starting from an empty one — this asserts the accumulator choice, which
    // is the ONLY thing that distinguishes full from delta.
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
    const cold = await syncCatalog(apiOver(server), EMPTY_SNAPSHOT);
    expect(cold.snapshot.rows.some((r) => r.id === 500)).toBe(false);

    const warm = await syncCatalog(apiOver(server), stored);
    expect(warm.snapshot.rows.some((r) => r.id === 500)).toBe(true);
  });

  it("stops at the page budget and REWINDS the cursor", async () => {
    // A runaway `has_next` must not hammer a production API, and a truncated
    // walk must not record progress it did not make — otherwise the next
    // delta sits on top of a catalogue that was never fully read and the gap
    // becomes permanent.
    const server = mockServer({
      "/categories/": () => ({
        body: page(ROWS.slice(0, 1), {
          page: 1,
          totalPages: 99,
          hasNext: true,
          globalMax: 7,
        }),
      }),
    });
    const result = await syncCatalog(apiOver(server), EMPTY_SNAPSHOT, {
      maxPages: 3,
    });

    expect(result.truncated).toBe(true);
    expect(result.pages).toBe(3);
    expect(result.snapshot.cursor).toBe(0);
    expect(result.snapshot.rows.length).toBeGreaterThan(0);
  });

  it("has a page budget by default", () => {
    expect(MAX_SYNC_PAGES).toBeGreaterThan(0);
  });

  it("produces a tree a screen can render", async () => {
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
    const result = await syncCatalog(apiOver(server), EMPTY_SNAPSHOT);
    const index = buildCategoryTree(result.snapshot.rows);
    expect(index.roots.map((n) => n.category.slug)).toEqual([
      "electronics",
      "vehicles",
    ]);
  });
});
