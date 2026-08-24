/**
 * Hand-authored API surface the codegen does not cover.
 *
 * Today that is exactly one thing: the keyset cursor, which the backend
 * publishes in a RESPONSE HEADER (`X-Moderation-Next-Before`, `views.py:377`)
 * that `@stapel/core`'s `StapelClient` does not expose — every method parses
 * the JSON body and drops the `Response`.
 *
 * Two ways out, and only one of them is honest:
 *
 *  - a second transport that reads the header itself. It would also have to
 *    re-implement the bearer token, the single-flight 401 refresh and the
 *    step-up-403 interception, all of which live in the shared client. The
 *    console is staff-gated: a transport without them would 401 on the first
 *    call. Rejected.
 *  - derive the cursor from the page. `views._page_cursor` (`views.py:179-181`)
 *    is literally `rows[-1].created_at`, and every list endpoint in the module
 *    is ordered `-created_at`. So the header carries no information the page
 *    does not — and the derivation is strictly BETTER at the one question the
 *    header cannot answer: the backend sets it whenever the page is non-empty,
 *    including on the last page, so a client that trusted its presence would
 *    always fetch one empty page too many. A short page means the end.
 *
 * The ask is filed for core (`SCRATCH/wave-b/REQUESTS-moderation-react.md`);
 * the day the client can hand back headers, {@link nextBefore} keeps its
 * signature and reads the real one.
 */

/** Anything keyset-paged by `created_at` — every list this module serves. */
export interface KeysetRow {
  readonly created_at: string;
}

/**
 * The `before` value for the NEXT page, or `undefined` when this page is the
 * last one.
 *
 * `limit` is the page size that was ASKED for. A page shorter than it is the
 * end of the list; a full page may or may not be, and asking again is the only
 * way to find out — which is what a keyset cursor is for.
 */
export function nextBefore(
  rows: readonly KeysetRow[],
  limit: number
): string | undefined {
  if (rows.length === 0 || rows.length < limit) return undefined;
  const last = rows[rows.length - 1];
  return last?.created_at;
}

/**
 * The header the backend sends, named once so a test can pin the spelling and
 * the day core exposes response headers there is a constant to reach for.
 */
export const NEXT_BEFORE_HEADER = "X-Moderation-Next-Before";
