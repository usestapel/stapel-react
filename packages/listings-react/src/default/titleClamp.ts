/**
 * `titleClamp` — how many lines of a listing title a card shows, and where the
 * cut goes when there are more.
 *
 * ── the defect ────────────────────────────────────────────────────────────
 *
 * The tile card (`ListingFeedCard`) clamped its title to two lines. The grid
 * card (`ListingCard`) used antd's `<Typography.Text ellipsis>`, which is ONE
 * line, and one line of a job or a part title lands in the middle of a word:
 * the live storefront's home grid drew titles cut as "Electrician - construc…"
 * and "Administrator - restaur…". The reference wraps the same titles over two
 * lines and cuts, if it has to, at the end of the second.
 *
 * Two cards, two different answers to the same question, and the wrong one was
 * on the busiest surface. So the answer lives here once and both cards read it.
 *
 * ── the rule ──────────────────────────────────────────────────────────────
 *
 *   display: -webkit-box + -webkit-box-orient: vertical + -webkit-line-clamp
 *     two lines, with the browser's own ellipsis at the end of the second.
 *   overflow-wrap: normal
 *     a long word moves to the next line whole rather than being broken across
 *     the wrap. Without it a narrow grid track will split a word to fill a
 *     line, which is the same defect one level down.
 *
 * ── why a hoisted stylesheet and not an inline style ──────────────────────
 *
 * `-webkit-line-clamp` and `-webkit-box-orient` do not survive the trip
 * through a React style object: the serializer and every DOM implementation
 * that is not a browser drop them silently, so a card written that way clamps
 * in Chrome, does not clamp in a test, and nothing anywhere says which. A
 * hoisted sheet keeps one copy for the document and makes the rule something a
 * test can read.
 *
 * Both cards emit the sheet under the SAME `href`, which is how React 19
 * deduplicates it — a second href carrying the same rule would hoist a second
 * copy for every page showing both card shapes.
 */

/** Lines of title a card draws before it clips. */
export const TITLE_CLAMP_LINES = 2;

/** The class a clamped title carries. */
export const TITLE_CLAMP_CLASS = "stapel-listing-title-clamp";

/** The `href` the hoisted stylesheet is deduplicated by. */
export const TITLE_CLAMP_STYLE_HREF = "stapel-listings-title-clamp";

/** The rule itself, as text, so a test can assert it. */
export function titleClampCss(): string {
  return (
    `.${TITLE_CLAMP_CLASS}{display:-webkit-box;-webkit-box-orient:vertical;` +
    `-webkit-line-clamp:${String(TITLE_CLAMP_LINES)};overflow:hidden;` +
    `overflow-wrap:normal}`
  );
}
