/**
 * `ratingFit` — what a rating badge gives up, and in what order, when the
 * column it was handed is narrower than the whole truth.
 *
 * ── the defect this replaces ──────────────────────────────────────────────
 *
 * 0.8.1 made the badge one line and gave the review COUNT an ellipsis, so the
 * count was the fact that got cut. On the live storefront's tile card that
 * produced a seller line ending "4.3 out of 5 · 6 revi…" — a word truncated in
 * the middle. An ellipsis inside a word is not a shorter sentence, it is a
 * broken one: "6 revi…" reads as a rendering failure, where "6 rev." reads as
 * an abbreviation somebody wrote on purpose. (The storefront that reported it
 * is Russian, where the same cut fell inside a six-letter word; the shape of
 * the defect is the same in every language.)
 *
 * So nothing is ever cut mid-word. Instead the badge drops whole FACTS, in a
 * stated order of sacrifice, and each step is a form somebody would actually
 * write by hand:
 *
 *   full         *****  4.3 out of 5 · 6 reviews
 *   no-scale     *****  4.3 · 6 reviews      — "out of 5" is the scale, and a
 *                                             five-star row already says what
 *                                             the scale is.
 *   one-star     *  4.3 · 6 reviews          — the star row becomes the single
 *                                             glyph that means "this number is
 *                                             a rating".
 *   short-count  *  4.3 · 6 rev.             — a real abbreviation from the
 *                                             dictionary, per locale. Never an
 *                                             ellipsis.
 *   score-only   *  4.3                      — the last fact standing is the
 *                                             number a person reads.
 *
 * The reference's own compact form puts the star AFTER the number; we keep the
 * glyph BEFORE it at every step so the reading order never changes as the
 * column narrows — a badge whose parts reorder while a card resizes is a
 * different kind of broken.
 *
 * ── why an ESTIMATE and not a fit loop ────────────────────────────────────
 *
 * The honest way to fit text is to render it and compare `scrollWidth` with
 * `clientWidth`. That costs a synchronous layout read per step per badge, and
 * a feed card draws one badge per card. It also cannot be tested anywhere
 * that does not lay out, which is every environment this package's suite runs
 * in.
 *
 * So the width of each candidate is ESTIMATED from the strings themselves and
 * from the type scale, and the widest candidate that fits is drawn. The
 * estimate is deliberately a little generous (see `GLYPH_RATIO`): stepping
 * down one rung early costs a person the full word "reviews" and costs them
 * nothing else, while stepping down one rung late puts the defect back.
 *
 * Because the estimate reads the ACTUAL strings, a locale with longer words
 * steps down sooner on the same card without anybody maintaining a second
 * table of numbers.
 *
 * ── why this does not oscillate ───────────────────────────────────────────
 *
 * The badge measures its own root, which in a card's seller line is a flex
 * ITEM: the width it reports is the width the layout GRANTED it, which is
 * already the outcome of shrinking. Narrowing the content cannot hand the
 * badge more room — a flex item only shrinks when the line overflows, and a
 * line that no longer overflows stops shrinking at exactly the content width.
 * The fixed point is therefore `granted == estimate(step)`, and the step above
 * it is by construction wider than that, so it never becomes eligible again.
 */
import { fontSize, spacing } from "@stapel/tokens";

/**
 * The rungs, widest first. The order IS the order of sacrifice, and the
 * ladder is walked from the top: the first rung that fits is the one drawn.
 */
export const RATING_FIT_LADDER = [
  "full",
  "no-scale",
  "one-star",
  "short-count",
  "score-only",
] as const;

export type RatingFitStep = (typeof RATING_FIT_LADDER)[number];

/** What each rung actually shows — the shape a renderer reads. */
export interface RatingFitShape {
  /** Draw the whole star row (`true`) or the single summary glyph (`false`). */
  readonly allStars: boolean;
  /** Say the scale out loud ("4.3 out of 5") or just the number ("4.3"). */
  readonly withScale: boolean;
  /** Show the review count at all. */
  readonly withCount: boolean;
  /** Show it in its abbreviated form. Meaningless when `withCount` is false. */
  readonly shortCount: boolean;
}

const SHAPES: Readonly<Record<RatingFitStep, RatingFitShape>> = {
  full: { allStars: true, withScale: true, withCount: true, shortCount: false },
  "no-scale": {
    allStars: true,
    withScale: false,
    withCount: true,
    shortCount: false,
  },
  "one-star": {
    allStars: false,
    withScale: false,
    withCount: true,
    shortCount: false,
  },
  "short-count": {
    allStars: false,
    withScale: false,
    withCount: true,
    shortCount: true,
  },
  "score-only": {
    allStars: false,
    withScale: false,
    withCount: false,
    shortCount: false,
  },
};

/** What each rung shows. */
export function ratingFitShape(step: RatingFitStep): RatingFitShape {
  return SHAPES[step];
}

/**
 * Mean glyph advance as a fraction of the font size.
 *
 * 0.55 is the usual figure for mixed-case Latin and Cyrillic text in a UI sans at
 * a text size; digits in these faces are tabular and a touch narrower, and a
 * space is narrower still, so a string of digits and short words measures a
 * little under the estimate. That bias is the one we want — see the header.
 */
const GLYPH_RATIO = 0.55;

/**
 * Gap between two stars as a fraction of the glyph size, read off antd's own
 * `<Rate>`: measured on the stand at a 32px glyph the star boxes carried a
 * 12px `margin-inline-end`, and 12/32 is this number. It is a ratio rather
 * than a pixel constant so it survives the glyph size changing.
 */
const STAR_GAP_RATIO = 0.375;

/** The measurements a candidate's width is estimated from. */
export interface RatingFitMetrics {
  /** The star glyph size in CSS px. */
  readonly starSize: number;
  /** The text size in CSS px. */
  readonly textSize: number;
  /** The flex gap between the badge's items in CSS px. */
  readonly gap: number;
}

/**
 * The metrics the antd skin actually draws with: the icon step for the stars
 * (the same number `@stapel/tokens-antd` uses for a read-only `<Rate>`), the
 * body step for the text, and the row's own gap.
 */
export const RATING_FIT_METRICS: RatingFitMetrics = {
  starSize: fontSize.md.fontSize,
  textSize: fontSize.sm.fontSize,
  gap: spacing[1],
};

/** The strings a rung would put on screen, already translated. */
export interface RatingFitParts {
  /** "4.3 out of 5" */
  readonly score: string;
  /** "4.3" */
  readonly scoreBare: string;
  /** "6 reviews" */
  readonly count: string;
  /** "6 rev." */
  readonly countShort: string;
  /** How many stars the full row draws. */
  readonly stars: number;
}

function textWidth(text: string, metrics: RatingFitMetrics): number {
  return text.length * metrics.textSize * GLYPH_RATIO;
}

function starsWidth(count: number, metrics: RatingFitMetrics): number {
  if (count <= 0) return 0;
  return (
    count * metrics.starSize +
    (count - 1) * metrics.starSize * STAR_GAP_RATIO
  );
}

/**
 * The width one rung wants, in CSS px.
 *
 * Exported because the suite asserts the LADDER is strictly descending: a
 * rung that is not narrower than the one above it is a rung that can never be
 * reached, and that is a bug the estimate can develop silently when a string
 * changes.
 */
export function estimateRatingWidth(
  step: RatingFitStep,
  parts: RatingFitParts,
  metrics: RatingFitMetrics = RATING_FIT_METRICS
): number {
  const shape = SHAPES[step];
  let width = starsWidth(shape.allStars ? parts.stars : 1, metrics);
  width += metrics.gap;
  width += textWidth(shape.withScale ? parts.score : parts.scoreBare, metrics);
  if (shape.withCount) {
    // the middot and its two gaps
    width += metrics.gap + textWidth("·", metrics) + metrics.gap;
    width += textWidth(shape.shortCount ? parts.countShort : parts.count, metrics);
  }
  return width;
}

/**
 * The widest rung that fits `available` CSS px.
 *
 * `available === undefined` means the badge has not been measured yet — a
 * server render, an environment with no `ResizeObserver`, the frame before the
 * effect runs. The answer there is `full`: the unmeasured state should say
 * everything that is true, and the row's own `nowrap` keeps it one line for
 * the single frame before the first measurement lands.
 */
export function pickRatingFit(
  available: number | undefined,
  parts: RatingFitParts,
  metrics: RatingFitMetrics = RATING_FIT_METRICS
): RatingFitStep {
  if (available === undefined) return "full";
  for (const step of RATING_FIT_LADDER) {
    if (estimateRatingWidth(step, parts, metrics) <= available) return step;
  }
  // Narrower than the last rung: there is nothing left to give up, and a
  // rating still has to say its number.
  return RATING_FIT_LADDER[RATING_FIT_LADDER.length - 1] as RatingFitStep;
}
