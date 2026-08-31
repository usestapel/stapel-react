/**
 * THE BROWSE PROJECTION — which catalogue rows a PERSON may be offered.
 *
 * `GET /categories/api/v1/categories/` is a REVISION-SYNC contract, and it is
 * right to send rows nobody may browse. A consumer that never received a row
 * again could never learn that it went inactive, was soft-deleted, or was
 * renamed: the delta protocol works precisely because the endpoint keeps
 * talking about rows the storefront has stopped showing. So the filter belongs
 * HERE, on the consumer, and never on the request.
 *
 * On a live classified deployment that split is not academic. The list
 * endpoint answers 187 rows, of which 105 carry `active: false` — leftovers
 * from end-to-end runs, with slugs like `authz-1787369370`. Every one of them
 * is a legitimate row of the sync contract and none of them is a category a
 * shopper may be offered.
 *
 * ── The predicate, and the three things it reads ───────────────────────────
 *
 *   active   the storefront's visibility switch. OPTIONAL in the schema and
 *            `true` on the model, so the test is "not explicitly false" — an
 *            absent flag is an active category, never a hidden one.
 *   deleted  a TOMBSTONE, not an absence: soft-deleted rows are still served
 *            (`include_deleted` defaults to **true** on the list endpoint),
 *            which is exactly what makes the delta protocol work and exactly
 *            what shows a deleted category in a menu if nobody filters.
 *   is_test  a row a fixture created. NOT in the generated schema — the field
 *            is absent from `CategorySerializer` on the contract this pair is
 *            pinned to — so it is read defensively off the wire shape and an
 *            ABSENT flag means "not a test row". Assuming the opposite would
 *            empty the catalogue of every deployment whose serializer does not
 *            carry the field, which today is all of them.
 *
 * ── What this deliberately does NOT do ─────────────────────────────────────
 *
 * It does not pattern-match slugs. `authz-1787369370` looks like a fixture and
 * `storefront-2` looks like one too — right up until an operator names a real
 * category `winter-2026`. A heuristic over slugs silently deletes live
 * branches of somebody's catalogue with no error anywhere, which is a worse
 * failure than showing a test row: one is visible and reportable, the other is
 * not. The flags above are the deployment's own statement about a row, and a
 * statement beats a guess.
 *
 * ── Opting out ─────────────────────────────────────────────────────────────
 *
 * A catalogue ADMIN legitimately needs to see everything — that is where an
 * inactive row is un-retired and a tombstone is undeleted. Every hook that
 * projects for browsing therefore takes {@link CategoryVisibilityOptions} and
 * defaults to the browse answer; {@link ADMIN_VISIBILITY} is the whole opt-out
 * in one value. The SYNC CACHE is never filtered: the snapshot ingests every
 * row the server sends (see `catalog/sync.ts`), and only the projection over
 * it drops rows. Filtering the cache would break the next delta.
 */
import type { Category } from "../api/types.js";

/**
 * Which non-browsable rows to keep. Every flag defaults to `false`, which is
 * the storefront's answer; a catalogue admin turns on the ones it needs.
 */
export interface CategoryVisibilityOptions {
  /** Keep `deleted: true` rows (tombstones). Default `false`. */
  readonly includeDeleted?: boolean;
  /** Keep `active: false` rows. Default `false`. */
  readonly includeInactive?: boolean;
  /** Keep rows the deployment flagged as test data. Default `false`. */
  readonly includeTest?: boolean;
}

/**
 * The admin opt-out, as one value: show every row the sync contract sent.
 *
 * Named rather than spelled out at each call site so "the admin surface sees
 * everything" is one decision in one place — a surface that listed two of the
 * three flags would hide the third kind of row and look like it worked.
 */
export const ADMIN_VISIBILITY: CategoryVisibilityOptions = {
  includeDeleted: true,
  includeInactive: true,
  includeTest: true,
};

/**
 * Read a field the pinned schema does not declare, without lying about its
 * type. Returns `unknown`; the caller narrows.
 */
function wireField(row: Category, field: string): unknown {
  const bag: Record<string, unknown> = row;
  return bag[field];
}

/**
 * Did the deployment itself mark this row as test data?
 *
 * `true` ONLY for an explicit `is_test: true` on the wire. The field is not in
 * the generated schema, so its absence is the normal case and means "not a
 * test row" — see this file's header for why the opposite default would empty
 * every catalogue.
 */
export function isTestCategory(row: Category): boolean {
  return wireField(row, "is_test") === true;
}

/**
 * May this row be OFFERED to a person browsing?
 *
 * The one predicate every browse surface shares — the tile grid, the carousel,
 * the tree walk, the children of a category, the picker's search. One function
 * so a new surface cannot invent a fourth answer to "is this row live".
 */
export function isBrowsableCategory(
  row: Category,
  options: CategoryVisibilityOptions = {}
): boolean {
  if (row.deleted === true && options.includeDeleted !== true) return false;
  if (row.active === false && options.includeInactive !== true) return false;
  if (isTestCategory(row) && options.includeTest !== true) return false;
  return true;
}

/**
 * {@link isBrowsableCategory} over a list, order preserved.
 *
 * Generic in the row so a caller keeps whatever narrower type it had — a
 * filter that widened `Category` to something else would push a cast onto
 * every call site.
 */
export function browsableCategories<T extends Category>(
  rows: Iterable<T>,
  options: CategoryVisibilityOptions = {}
): readonly T[] {
  return [...rows].filter((row) => isBrowsableCategory(row, options));
}
