/**
 * ONE GAP BETWEEN THE LISTING PAGE'S BLOCKS, AND THE PANE IS THE ONE WHO SAYS
 * IT.
 *
 * ── What was on screen ────────────────────────────────────────────────────
 *
 * `<ListingDetailPane>` stacks its blocks in a `<Flex vertical gap>` and
 * declares 16px (12px in the buy column). Measured on the stand by the
 * tidiness probe at 1440 and 390, the gaps INSIDE that flex were 111.05,
 * 53.59, 42.39, 29 and 27 pixels. Five distances, none of them 16, none of
 * them chosen by anybody.
 *
 * The cause is not the gap. It is that a flex `gap` governs only the space a
 * container puts BETWEEN its children, and half the children here are antd
 * components carrying outer margins of their own:
 *
 *   `<Divider>`          24px above and 24px below, from antd's own sheet, so
 *                        one horizontal rule inside a 16px column costs 40 +
 *                        40;
 *   `<Typography.Title>` a margin-block-start proportional to its level, which
 *                        is right for prose in a document flow and is a second
 *                        opinion inside a container that already spaces its
 *                        children;
 *   `<Typography.Paragraph>` a bottom margin of about one line.
 *
 * A margin and a gap ADD. So the page's rhythm was the sum of two systems,
 * and reading either one of them told you nothing about what was drawn.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 *
 * `margin-block: 0` on every direct child of the pane's block columns —
 * the same three-line answer `@stapel/categories-react`'s `blockRhythm.ts`
 * gives for a catalogue page, and deliberately spelled the same way: a block's
 * own outer margin is a second opinion about a distance the container already
 * decided.
 *
 * It is a SHEET and not an inline style for the reason every other rule in
 * this package is: it addresses CHILDREN this component renders but does not
 * own, and an inline style cannot reach one.
 *
 * ── The divider keeps a spacing, because it is not a block ────────────────
 *
 * A horizontal rule is a SECTION BREAK: it needs more air than the space
 * between two blocks, or it reads as another row in the stack. So it is not
 * zeroed with the rest — it gets {@link DETAIL_RULE_CLASS}, one token step on
 * each side, which lands the break at `gap + step` and makes the number a
 * decision instead of whatever antd's 24 happened to sum to. The class beats
 * the reset on specificity (`.col > .rule` over `.col > *`) without an
 * `!important`, and a host can out-specify it with one more condition.
 */
import type { CSSProperties } from "react";
import { spacing } from "@stapel/tokens";

/** The class the pane's block columns carry. */
export const DETAIL_RHYTHM_CLASS = "stapel-listings-detail-column";

/** The class the pane's horizontal rule carries. */
export const DETAIL_RULE_CLASS = "stapel-listings-detail-rule";

/** The `href` the hoisted rhythm sheet is deduplicated by. */
export const DETAIL_RHYTHM_STYLE_HREF = "stapel-listings-detail-rhythm";

/**
 * ONE TOKEN STEP of extra air on each side of the section rule — see the file
 * header. Exported so a test reads the decision rather than a literal, and so
 * a container laying out beside the rule measures against the same number.
 */
export const DETAIL_RULE_SPACE: number = spacing[2];

/**
 * THE ONE BLOCK THE SHEET CANNOT REACH: A HEADING.
 *
 * `${column}>*` is one class and no element — specificity (0,1,0). antd writes
 * its heading margins as `h2.ant-typography` — one class AND one element,
 * (0,1,1) — so a `<Typography.Title>` keeps its own `margin-block` no matter
 * what the column's reset says, and it is the only child of the pane that
 * does. Measured on the stand with the reset already live: 29px between the
 * price and the actions at 1440 and 27 at 390 where the buy column declares
 * 12, and 42.4 / 53.6 where the reading column declares 16. Five distances,
 * none of them the gap, all of them a heading's margin added to it.
 *
 * Raising the sheet's specificity would mean naming antd's class in this
 * package's stylesheet or doubling the column's own class to out-rank it —
 * a selector that says nothing about the decision. An INLINE declaration is
 * beaten by nothing short of `!important`, it travels with the heading it
 * belongs to, and it says the same thing the sheet says: the container owns
 * the distance between its blocks.
 *
 * Both ends, because both are the same second opinion — a heading after a
 * paragraph takes antd's `margin-top` as well, which is what made the reading
 * column's two distances differ from each other.
 */
export const DETAIL_TITLE_RESET: CSSProperties = {
  marginBlockStart: 0,
  marginBlockEnd: 0,
};

/** The rhythm's two rules. */
export function detailRhythmCss(): string {
  const column = `.${DETAIL_RHYTHM_CLASS}`;
  return [
    // A block's own outer margin is a second opinion about the same distance.
    `${column}>*{margin-block:0}`,
    // …except the section rule, which is a break and not a block.
    `${column}>.${DETAIL_RULE_CLASS}{margin-block:${String(DETAIL_RULE_SPACE)}px}`,
  ].join("");
}
