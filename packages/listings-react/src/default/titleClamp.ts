/**
 * `titleClamp` — how a listing card cuts a string that outruns its column:
 * how many lines it gets, and where the cut goes when there are more.
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
 * ── the defect, second round: the LOCATION line ───────────────────────────
 *
 * The titles were fixed and the place name one row below them was not. On a
 * live storefront at 390px, where the grid card is tiled two across, the place
 * still came out cut inside a word: a city name, a comma, and the district
 * name that follows it chopped four letters in — measured on cards for two
 * different Russian cities. All three cards were still on antd's one-line
 * `ellipsis` for the place, and the list card on no rule at all.
 *
 * That is this module's own defect, one row further down the same card: a card
 * answering "how do I cut text" twice. So the LINE COUNT is a parameter of the
 * one rule rather than the excuse for a second one — same module, same hoisted
 * sheet, same "cut after a whole word", a different count.
 *
 * ── the rule ──────────────────────────────────────────────────────────────
 *
 *   display: -webkit-box + -webkit-box-orient: vertical + -webkit-line-clamp
 *     N lines, with the browser's own ellipsis at the end of the Nth.
 *   overflow-wrap: normal
 *     a long word moves to the next line whole rather than being broken across
 *     the wrap. Without it a narrow grid track will split a word to fill a
 *     line, which is the same defect one level down.
 *
 * At N = 1 those two together are the whole difference from antd's `ellipsis`.
 * `ellipsis` is `white-space: nowrap`, so the line has no break opportunity at
 * all and the cut falls at whatever pixel the column ends — inside a word,
 * always. A one-line `-webkit-box` still WRAPS: the browser breaks at the last
 * word boundary that fits, hides the rest, and puts the ellipsis after a whole
 * word. Which is why a card that carried this class AND kept the `ellipsis`
 * prop would look exactly as broken as before — the prop has to go.
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
 * Both arms ride in ONE sheet under ONE `href`, which is how React 19
 * deduplicates it — a second href carrying the same rules would hoist a second
 * copy for every page showing both card shapes.
 */

/**
 * Lines of TITLE a card draws before it clips.
 *
 * Two: a listing title is a sentence a seller wrote, and the reference wraps
 * it. One line cut the trade off the front of the job.
 */
export const TITLE_CLAMP_LINES = 2;

/**
 * Lines of the LOCATION line a card draws before it clips.
 *
 * ONE, deliberately, and not the title's two.
 *
 * The place is a subtitle, not prose: which city it is reads from the first
 * words, and a second line buys nothing but the district. Against that, the
 * card's height has to be a property of the GRID rather than of how long this
 * particular neighbourhood happens to be called — measured on a live 1440px
 * feed (D185), a two-part city-and-district name wrapped, the text block grew
 * 104 -> 128px, and the two cards either side of it stood 24px shorter: a row
 * of tiles with a ragged bottom edge and a heart hanging below its own line.
 * At 390px two across, where this was measured again, every place name is a
 * candidate to wrap, so the ragged row would be the common case rather than
 * the exception.
 *
 * One line was therefore always the intended COUNT — the bug was only the cut:
 * antd's `ellipsis` gets one line by forbidding the wrap, which puts the
 * ellipsis inside a word. This gets one line by allowing the wrap and hiding
 * what follows, which puts it after one.
 */
export const LOCATION_CLAMP_LINES = 1;

/** The line counts a card can ask for. Widen this, not the call sites. */
export type ClampLines = typeof TITLE_CLAMP_LINES | typeof LOCATION_CLAMP_LINES;

/** The class a clamped title carries. */
export const TITLE_CLAMP_CLASS = "stapel-listing-title-clamp";

/** The class a clamped location line carries. */
export const LOCATION_CLAMP_CLASS = "stapel-listing-line-clamp";

/**
 * The class for a given line count.
 *
 * One class per count rather than one class plus an inline `-webkit-line-clamp`
 * override: the override would be a style object, and a style object is where
 * this property goes silently missing (see the header).
 *
 * The two names are not symmetrical because the title's is older than the
 * parameter and is on the published DOM — a host stylesheet may already reach
 * for it, and renaming a class in a patch is a change nobody asked for.
 */
export function clampClass(lines: ClampLines): string {
  return lines === TITLE_CLAMP_LINES ? TITLE_CLAMP_CLASS : LOCATION_CLAMP_CLASS;
}

/** The `href` the hoisted stylesheet is deduplicated by. */
export const CARD_CLAMP_STYLE_HREF = "stapel-listings-title-clamp";

/**
 * One arm of the sheet.
 *
 * ── Why the class is written TWICE ────────────────────────────────────────
 *
 * `-webkit-line-clamp` does nothing without `display: -webkit-box`, so that
 * one declaration is the whole clamp — and it is the easiest declaration in
 * the rule for a host to overwrite by accident. A single class selector scores
 * (0,1,0), exactly the same as the `[data-testid="…-title"]` selector a
 * container naturally reaches for, so whichever stylesheet loads LAST wins.
 * Measured on a live storefront (2026-09-13): the host set `display: block` on
 * its title testids to stop two inline spans running together, that rule
 * happened to come second, and every clamp in the app went inert — the class
 * was on the element, the sheet was in the head, `-webkit-line-clamp: 2` was
 * in the computed style, and a 113-character title still drew three lines.
 *
 * Repeating the class scores (0,2,0), which outranks any single class or
 * attribute selector whatever the load order, and still loses to a host that
 * really means it (an id, a doubled selector of its own, `!important`). That
 * is the right place on the ladder: a clamp that cannot be overridden at all
 * is a different bug.
 */
function clampRule(lines: ClampLines): string {
  const self = `.${clampClass(lines)}.${clampClass(lines)}`;
  return (
    `${self}{display:-webkit-box;-webkit-box-orient:vertical;` +
    `-webkit-line-clamp:${String(lines)};overflow:hidden;` +
    `overflow-wrap:normal}`
  );
}

/** The sheet itself, as text, so a test can assert it. */
export function cardClampCss(): string {
  return clampRule(TITLE_CLAMP_LINES) + clampRule(LOCATION_CLAMP_LINES);
}
