/**
 * The delta protocol, as pure state transitions.
 *
 * `stapel-categories` documents the flow on the viewset itself (`views.py`,
 * `CategoryViewSet` docstring): full `GET /categories/` → store
 * `revisions.global_max` → later `GET /categories/?min_revision=<stored>` →
 * drop the rows that come back `deleted: true`. The spec's verdict (§4.3) is
 * that the result lives in `createRepository()` rather than being refetched
 * per page, because without it every storefront page pulls the whole
 * catalogue.
 *
 * Three things the documented flow does not say, all of which change the code:
 *
 * 1. **`revisions.deleted_ids` is the authoritative tombstone channel**, not
 *    the `deleted: true` rows. The rows are PAGINATED — a tombstone can land
 *    on page 3 of a walk that stopped at page 2 — while `deleted_ids` is
 *    computed unpaginated over `deleted=True AND revision > min_revision`
 *    (`stapel_core/django/api/revision.py`). It is also a snapshot of the
 *    CURRENT flag, so a category deleted and then restored is simply absent
 *    from it. Both channels are applied; the list is the one that is complete.
 *    On a FULL sync `deleted_ids` is `[]` by construction (the server only
 *    computes it when `min_revision` was sent), which is why dropping
 *    `deleted: true` rows still matters.
 *
 * 2. **A multi-page walk must pin its upper bound.** Pages are ordered by
 *    `revision` and filtered at request time; a write landing between page 1
 *    and page 2 shifts every subsequent page boundary, and the walk silently
 *    skips a row. `max_revision` exists for exactly this and the documented
 *    flow never mentions it: `nextPageRequest` pins the window to the
 *    `global_max` observed on the FIRST page and stores that as the new
 *    cursor. Anything written during the walk is picked up by the next delta.
 *
 * 3. **`revisions.global_max` is a property of the TABLE, not of the page** —
 *    it is `Max(revision)` over the whole model, so it is already the right
 *    cursor even when the page came back empty.
 */
import type { Category, CategoryPage } from "../api/types.js";
import type { CategoryListParams } from "../api/types.js";

/** The persisted catalogue: rows plus the cursor they are current as of. */
export interface CategorySnapshot {
  /** Storage-format marker. A snapshot written by an older shape is discarded
   * rather than migrated — it is a cache, and a full resync costs one request. */
  readonly version: 1;
  /** `revisions.global_max` as of the last completed sync. */
  readonly cursor: number;
  /** Live rows, tombstones already applied. Order is not meaningful. */
  readonly rows: readonly Category[];
}

/** An empty snapshot — the state before the first sync. */
export const EMPTY_SNAPSHOT: CategorySnapshot = {
  version: 1,
  cursor: 0,
  rows: [],
};

/** A snapshot with no rows has never synced, whatever its cursor says. */
export function isEmptySnapshot(snapshot: CategorySnapshot): boolean {
  return snapshot.rows.length === 0;
}

/**
 * Accept a value read back from persistence, or reject it.
 *
 * A repository read can hand back anything: a snapshot written by a previous
 * version of this pair, a half-written value, `undefined` after a cleared
 * origin. Every one of those must degrade to "no snapshot" — a cache that
 * throws on read is worse than no cache.
 */
export function parseSnapshot(value: unknown): CategorySnapshot | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<CategorySnapshot>;
  if (candidate.version !== 1) return undefined;
  if (typeof candidate.cursor !== "number" || !Number.isFinite(candidate.cursor)) {
    return undefined;
  }
  if (!Array.isArray(candidate.rows)) return undefined;
  for (const row of candidate.rows) {
    if (typeof row !== "object" || row === null) return undefined;
    if (typeof (row as Category).id !== "number") return undefined;
  }
  return {
    version: 1,
    cursor: candidate.cursor,
    rows: candidate.rows as readonly Category[],
  };
}

/**
 * The request that starts a sync from `snapshot`.
 *
 * A cold start asks for everything with `include_deleted: false` — nothing is
 * cached, so a tombstone has nothing to evict and the payload is smaller. A
 * warm start asks for the delta with `include_deleted: true`, because there
 * the tombstones are the point.
 */
export function firstPageRequest(snapshot: CategorySnapshot): CategoryListParams {
  if (isEmptySnapshot(snapshot)) {
    return { includeDeleted: false, page: 1 };
  }
  return { minRevision: snapshot.cursor, includeDeleted: true, page: 1 };
}

/**
 * The request for the next page of an in-flight walk, or `undefined` when the
 * walk is done.
 *
 * `maxRevision` pins the window to what the first page reported, so the walk
 * reads one consistent snapshot of the table instead of a moving one.
 */
export function nextPageRequest(
  previous: CategoryListParams,
  page: CategoryPage
): CategoryListParams | undefined {
  if (!page.pagination.has_next) return undefined;
  return {
    ...previous,
    page: page.pagination.page + 1,
    maxRevision: previous.maxRevision ?? page.revisions.global_max,
  };
}

/**
 * Fold one page into an accumulator.
 *
 * There is one merge rule, and the FULL/DELTA distinction lives in what the
 * caller starts from, not in a flag here: a delta folds into the stored
 * snapshot, a full sync folds into {@link EMPTY_SNAPSHOT}. That is the whole
 * difference — a row the server no longer lists is gone from a full listing
 * precisely because it was never folded in. Expressing it as a flag on the
 * merge invites the two silent failures instead: a delta treated as full
 * empties the catalogue, a full treated as delta resurrects rows deleted while
 * the client was away.
 *
 * The new snapshot is not published until the walk COMPLETES (see
 * `model/catalogSync.ts`), so a walk that fails halfway leaves the previous
 * catalogue on screen rather than a truncated one.
 *
 * The cursor only ever moves FORWARD, and never past `cursorLimit`:
 * `global_max` is the table's live maximum, which can already exceed the
 * window a walk pinned with `max_revision`. Taking it verbatim would record
 * having read rows the walk never asked for.
 */
export function applyCategoryPage(
  accumulator: CategorySnapshot,
  page: CategoryPage,
  options: { readonly cursorLimit?: number } = {}
): CategorySnapshot {
  const byId = new Map<number, Category>();
  for (const row of accumulator.rows) byId.set(row.id, row);

  for (const row of page.results) {
    if (row.deleted === true) byId.delete(row.id);
    else byId.set(row.id, row);
  }
  for (const id of page.revisions.deleted_ids) byId.delete(id);

  const observed =
    options.cursorLimit !== undefined
      ? Math.min(page.revisions.global_max, options.cursorLimit)
      : page.revisions.global_max;

  return {
    version: 1,
    cursor: Math.max(accumulator.cursor, observed),
    rows: [...byId.values()],
  };
}
